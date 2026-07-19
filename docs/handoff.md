# ТуваФото — handoff для новой сессии

Документ для продолжения работы в новой сессии. Здесь — что за проект, стек,
структура, что уже сделано, что дальше, правила и подводные камни.

---

## 1. Что за проект

Сайт фотографа выпускных альбомов (школы, детсады). Бренд **ТуваФото**,
фотограф Иванов Александр, Республика Тыва, г. Кызыл.

Возможности: витрина с 3D-книгой альбомов, каталог по категориям, страница
альбома, **конструктор альбома** с расчётом цены и оформлением заказа,
авторизация (email+пароль с 2FA, Яндекс/VK ID), личный кабинет, PWA, cookie-
баннер и согласия 152-ФЗ, планируется админ-панель владельца.

**Дизайн-эталон:** `C:\Users\filip\Downloads\Веб-сайт для выпускных альбомов\design_handoff_tuvafoto`
(HTML-прототип `ТуваФото.dc.html`, `Book.dc.html`). Прод-фреймворк прототипа
(`support.js`) НЕ используется — это только эталон вёрстки/поведения. Копия
макета лежит в репозитории в `Макет/`.

---

## 2. Стек

**Frontend** (`apps/web`): React 19 + TypeScript + Vite 8, React Router 7,
Tailwind v4 (токены в `src/index.css` через `@theme`), Zustand (стор авторизации),
TanStack Query (данные с API), vite-plugin-pwa (PWA). 3D-книга — чистые CSS-
трансформы, без библиотек.

**Backend** (`apps/api`): NestJS 11 + TypeScript, Prisma 7 + PostgreSQL,
argon2 (пароли), @nestjs/jwt, @nestjs/throttler, nodemailer (SMTP), cookie-parser.

**Инфраструктура:** Docker Compose (Postgres 17-alpine), npm workspaces
(монорепозиторий). Всё запускается одной командой `npm start`.

**Прод (план):** российский VPS (152-ФЗ — данные в РФ), Docker Compose +
Nginx/Caddy + Let's Encrypt. Гайд деплоя — `docs/DEPLOY.md`.

---

## 3. Структура репозитория

```
ТуваФото/
├── apps/
│   ├── web/                      # фронтенд
│   │   └── src/
│   │       ├── components/       # Nav, Footer, Book, Photo, Logo, Modal, Toast,
│   │       │                     #   FloatingCall, Layout, ProtectedRoute, CookieBanner
│   │       │   └── auth/         # AuthLayout, AuthBits, PhoneField
│   │       ├── pages/            # Home, Catalog, Album, Contacts, Install,
│   │       │                     #   Constructor, Profile
│   │       │   ├── auth/         # Login, Register, Verify, ForgotPassword,
│   │       │   │                 #   ResetPassword, FinishSetup, FinishProfile, OAuthCallback
│   │       │   └── profile/      # SecurityPage, ConnectionsPage, ProfileSubLayout
│   │       ├── domain/           # types, demoData, pricing, useAbout
│   │       ├── lib/              # api.ts (клиент), phone.ts, storage.ts
│   │       ├── store/            # auth.ts (Zustand)
│   │       └── pwa/              # UpdatePrompt, InstallBanner, useInstall
│   └── api/                      # бэкенд
│       ├── prisma/              # schema.prisma, migrations/, seed.ts
│       └── src/
│           ├── auth/            # auth.service/controller, guards, decorators, dto,
│           │                    #   oauth/ (providers, oauth.service/controller), cookies.ts
│           ├── about/           # about.controller (публичные данные фотографа)
│           ├── catalog/         # catalog.controller (options для конструктора)
│           ├── orders/          # orders.service/controller, dto
│           ├── mail/            # mail.service (SMTP или консоль)
│           ├── common/          # phone.ts, pricing.ts
│           ├── prisma/          # prisma.service/module
│           └── health/          # health.controller
├── docs/                        # Как-запустить.md, DEPLOY.md, stack.md, handoff.md
├── Макет/                       # копия HTML-прототипа (эталон)
├── docker-compose.yml           # Postgres (name: tuvafoto)
└── package.json                 # workspaces + скрипты (npm start и т.д.)
```

---

## 4. Что уже сделано

### Frontend (публичная часть)
- Главная: hero-карусель, секция книг (по 2 в ряд, крупные), отзывы с модалкой,
  CTA, футер, плавающая кнопка звонка.
- Каталог с фильтром по категориям, страница альбома, контакты.
- **Компонент Book** — 3D-книга с перелистыванием, автоплеем, fullscreen
  (порталом в body). Сама ужимается под ширину экрана. Кнопки листания и
  режимов на разных строках.
- PWA: плашка обновления (`prompt`), промо установки (раз в сутки), страница
  `/install`.
- Адаптив проверен до 320–340px (нет горизонтального скролла).

### Frontend (авторизация и кабинет)
- Вход, регистрация (с телефоном и маской +7 (9xx) xxx-xx-xx), 2FA (4 поля,
  автопереход, вставка, **повторная отправка кода с таймером-кулдауном**).
- Восстановление пароля (форма → письмо/консоль → страница /reset-password).
- Онбординг владельца: `/finish-setup` (смена временных логина/пароля) →
  `/finish-profile` (ФИО, адрес, телефон → блок «О фотографе»).
- Профиль: карточка (аватар+ФИО на одной строке, без роли), разделы-кнопки
  (Безопасность, Подключённые аккаунты, Мои альбомы, Админ-панель для владельца).
- Безопасность: смена пароля + список сессий с отзывом.
- Подключённые аккаунты: привязка/отвязка Яндекс/VK.
- Бургер-меню: карточка пользователя (аватар+ФИО → профиль), внизу
  Админ-панель (только владельцу) и Выйти (красная выделенная).

### Frontend (конструктор)
- `/constructor`: пресеты (Применить настройки), выбор обложки, множественный
  выбор видов съёмки, слайдер разворотов, sticky-сводка с live-расчётом,
  выбор предоплата 50%/полная, форма контактов, модалка оплаты (СБП/карта) →
  тост «Заказ №N оформлен».

### Backend
- Auth: register/login/verify/refresh/logout, 2FA-коды (хэш, лимит попыток,
  кулдаун пересылки), сессии (хэш refresh-токена, ротация), сброс пароля,
  смена пароля, смена доступов, заполнение профиля, гварды (JWT + Roles),
  троттлинг. **Гвард проверяет живость сессии в БД** — отзыв действует немедленно.
- OAuth: Яндекс/VK за интерфейсом, вход + привязка к аккаунту, отвязка.
- Публичные: `GET /about` (данные фотографа), `GET /catalog/options`
  (виды съёмки + обложки).
- Заказы: `POST /orders` — **сервер сам пересчитывает цену** из справочников БД,
  клиентской сумме не доверяет.
- Почта: SMTP через nodemailer; если `SMTP_HOST` пуст — код/ссылка печатаются
  в консоль с пометкой `[DEV-EMAIL]`.
- Сид: владелец (один, при существующем не дублируется), категории, виды
  съёмки, обложки, блок «О фотографе».

### API-эндпоинты (все под префиксом `/api`)
```
GET  /health
GET  /about
GET  /catalog/options
POST /orders
POST /auth/register | login | verify | resend | refresh | logout
POST /auth/forgot-password | reset-password | change-password
POST /auth/change-credentials | complete-profile
GET  /auth/me | sessions ; DELETE /auth/sessions/:id | sessions
GET  /auth/oauth/providers ; GET /auth/oauth/:provider/start | callback
POST /auth/oauth/:provider/link ; GET /auth/oauth/connections ; DELETE /auth/oauth/:provider
```

### Модели БД (Prisma)
User, OAuthAccount, Session, TwoFactorCode, PasswordResetToken, Image, Category,
ShootType, CoverVariant, Album, Spread, HeroSlide, Order, Review, About,
ShareAlbum, Consent. Enum: Role, PayType, PayMethod, OrderStatus, ConsentKind.

Миграции (6): init, add_user_phone, owner_must_change_credentials,
password_reset_token, owner_must_complete_profile, twofactor_resend.

---

## 5. Что дальше (план)

**Ближайшее — админ-панель `/admin`** (сейчас заглушка). Подробности — раздел 9.
Ключевое: заказы + realtime-счётчик новых.

Дальше по README-эталону:
- Админка: категории, альбомы (с фото), обложки, «О фотографе» (редактирование),
  заказы, готовые альбомы со ссылками `/share/:token` (срок действия).
- **Связать админские альбомы/категории с публичной витриной** — сейчас каталог
  и книги на главной показывают ДЕМО-данные (`apps/web/src/domain/demoData.ts`),
  отдельно от БД. Нужны публичные эндпоинты каталога/альбомов и переход витрины
  на них.
- Загрузка и хранение изображений (обложки, страницы, фото фотографа).
- Реальные платежи (СБП QR, эквайринг) + вебхуки подтверждения — сейчас мок.
- Реальный SMTP (сейчас консоль), реальные ключи OAuth.
- Отзывы/согласия/готовые альбомы в БД (модели есть, эндпоинтов ещё нет).
- **Автоудаление временных share-альбомов по `expiresAt`** (фоновая джоба) —
  см. память проекта про стратегию хранилища.

---

## 6. Правила и договорённости (ВАЖНО соблюдать)

**Безопасность и данные:**
- Пароли — только argon2id-хэш. Refresh-токены, коды 2FA, токены сброса — sha256.
- Вход по паролю обязательно с 2FA (код на почту / в консоль на деве).
- Refresh — в httpOnly-куке (в проде ещё и Secure), ротируется при каждом
  обновлении. Access-токен — в памяти клиента (не в localStorage).
- JWT-гвард проверяет, что сессия жива в БД → отзыв/смена пароля действуют сразу.
- **Цену заказа сервер всегда пересчитывает сам** из справочников БД, сумме с
  клиента не доверяет. Формула продублирована: `apps/api/src/common/pricing.ts`
  и `apps/web/src/domain/pricing.ts` — держать синхронными.
- Все защищённые ручки закрыты по умолчанию; открываются явным `@Public()`.
  Роль — из подписанного токена. Админские действия — `@Roles('OWNER')`.
- Согласия 152-ФЗ пишутся с версией политики, IP, датой. Данные — в РФ.
- Владелец один; при первом входе обязан сменить временные доступы и заполнить
  профиль. Регистрации админов нет.
- Email нормализуется в нижний регистр (и в сиде тоже — иначе владелец не войдёт).
- Телефон хранится в E.164 (+79XXXXXXXXX), форматируется при выводе.

**Процесс / организация:**
- **Коммитит и пушит ТОЛЬКО пользователь сам.** Claude не коммитит. Автор
  коммитов — Filipp (git config local в репо). Ассистент оставляет изменения
  в рабочем дереве и подсказывает команды.
- Репозиторий: `github.com/sobolev-filipp/-` (личный аккаунт пользователя).
- Отвечать и писать комментарии/тексты — на русском.
- Верифицировать изменения в браузере, а не только typecheck (проект это
  требует). Тесты бэкенда — прогонять скриптом через живой API.
- Комментарии в коде объясняют «почему», а не «что».
- Дизайн-токены менять только в `apps/web/src/index.css` (`@theme`).

---

## 7. Подводные камни (с чем столкнулись / можно столкнуться)

- **Docker Desktop сам выключается** между сессиями. Перед работой с БД —
  запускать `Docker Desktop.exe` и ждать демон (`docker ps`).
- **Имя папки кириллицей** ломает Docker Compose (пустое имя проекта) —
  в `docker-compose.yml` жёстко задано `name: tuvafoto`.
- **Copy-Item .env.example → .env затирает существующий .env** — в инструкции
  теперь через `if (-not (Test-Path ...))`. Из-за этого один раз потерялся
  пароль владельца.
- **Prisma 7:** строка подключения НЕ в `schema.prisma`, а в `prisma.config.ts`;
  клиент через драйвер-адаптер `@prisma/adapter-pg`.
- **`prisma migrate reset` блокируется, когда его запускает Claude Code** —
  защита Prisma. Пользователь у себя запустит (`npm run db:reset`), команда
  интерактивная (спросит y).
- **TS 6 / erasableSyntaxOnly на фронте:** нельзя параметры-свойства в
  конструкторе; `baseUrl` в tsconfig устарел (только `paths`); нужен `rootDir`.
- **Nest build + incremental + deleteOutDir** роняли часть выхода — на бэке
  `incremental: false`.
- **React StrictMode дважды вызывает эффекты** — `bootstrap` авторизации и
  refresh-токен ротируется; сделан дедуп через общий промис. То же для
  OAuthCallback (ref-guard).
- **Маска телефона:** переформатирование сбивало каретку — восстанавливаем
  позицию по числу цифр слева (`PhoneField`).
- **Book свёрстан в px** — на узких экранах уезжал; считает размер по
  `documentElement.clientWidth` (не `innerWidth` — тот включает скроллбар).
  Fullscreen — порталом в body (иначе перекрывался анимацией/шапкой).
- **z-index:** открытое бургер-меню должно быть выше cookie-баннера (z-70) —
  сейчас overlay z-71, drawer z-72.
- **Сид плодил дубль-владельца**, если владелец сменил email — теперь сид
  создаёт владельца только если владельца нет вообще.
- **Демо-данные vs БД:** витрина (каталог, книги на главной) на демо-данных,
  а справочники конструктора — из БД. При постройке админки/витрины свести.
- Автоматизация браузера: клики по `ref` иногда мажут при несовпадении
  масштаба скриншота (800) и вьюпорта (1280) — надёжнее кликать через
  `javascript_exec` или ставить размер окна = скриншоту.

---

## 8. Как запустить (кратко)

Полная инструкция — `docs/Как-запустить.md`. Кратко (из корня, Docker запущен):
```
npm run setup      # первый раз: зависимости + БД + сид
npm start          # база + оба сервера (API 3000, web 5173) в одном окне
npm run db:reset   # сбросить БД к заводскому состоянию
```
Сайт: http://localhost:5173 · Health: http://localhost:3000/api/health

**Вход владельца** (после первого запуска / сброса): `Tuvafoto@mail.ru` /
`TuvaFoto-2026` (временный, в `apps/api/.env.example`). При первом входе —
2FA (код в консоли сервера, среди строк `[API]`/`[DEV-EMAIL]`), затем
принудительная смена доступов и заполнение профиля.

> Текущий реальный владелец в dev-БД — `filipp.sobolev1999@gmail.com` (пароль
> пользователь задал сам, флаг `mustCompleteProfile=true`). Если нужен чистый
> старт — `npm run db:reset`.

---

## 9. Следующая задача: админ-панель с заказами и realtime-счётчиком

Что нужно (первый этап админки):

**Backend:**
1. `GET /api/admin/orders` (`@Roles('OWNER')`) — список заказов с составом
   (fio, school, phone, съёмки, обложка, развороты, суммы, payType, status,
   createdAt, readAt). Модель `Order` уже готова.
2. `POST /api/admin/orders/:id/read` или `read-all` — отметить прочитанными
   (проставить `readAt`). Счётчик новых = заказы с `readAt = null`.
3. `GET /api/admin/orders/unread-count` — число новых (для бейджа).
4. **Realtime:** WebSocket-гейтвей (@nestjs/websockets + socket.io), комната
   `admin` (только OWNER), событие `order.created` при `POST /orders`. Фолбэк —
   поллинг счётчика. Считать новые по БД (`readAt = null`), чтобы бейдж
   переживал перезагрузку.

**Frontend:**
1. Страница `/admin` (сейчас Stub) — левое меню-вкладки, первая вкладка «Заказы».
2. Список заказов с полной инфо, отметка «прочитано».
3. **Возле пункта «Заказы» — число новых** (бейдж). Обновляется в реальном
   времени по WebSocket (или поллингом).
4. Подключить socket.io-client, комнату admin, инкремент счётчика на
   `order.created`.

**Правила для этого этапа:** админские эндпоинты строго `@Roles('OWNER')`;
WebSocket-комнату admin авторизовать по токену и роли; счётчик новых — из БД,
не только из сокета.

Установить на бэке: `@nestjs/websockets @nestjs/platform-socket.io socket.io`,
на фронте: `socket.io-client`.
