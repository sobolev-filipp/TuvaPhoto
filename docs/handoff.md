# ТуваФото — handoff для новой сессии

Документ для продолжения работы в новой сессии. Здесь — что за проект, стек,
структура, что уже сделано, что дальше, правила и подводные камни.
**Обновлён после большой сессии: админка, платежи/возвраты, альбомы, витрина на БД.**

---

## 1. Что за проект

Сайт фотографа выпускных альбомов (школы, детсады). Бренд **ТуваФото**,
фотограф Иванов Александр, Республика Тыва, г. Кызыл.

Возможности: витрина с 3D-книгой альбомов, каталог по категориям, страница
альбома, **конструктор альбома** с расчётом цены и оформлением заказа,
авторизация (email+пароль с 2FA, Яндекс/VK ID), личный кабинет, PWA, cookie-
баннер и согласия 152-ФЗ, **админ-панель владельца** (заказы, категории, альбомы).

**Дизайн-эталон:** `C:\Users\filip\Downloads\Веб-сайт для выпускных альбомов\design_handoff_tuvafoto`
(HTML-прототип `ТуваФото.dc.html`, `Book.dc.html`). Копия макета — в `Макет/`.
Прод-фреймворк прототипа (`support.js`) НЕ используется — только эталон вёрстки.

---

## 2. Стек

**Frontend** (`apps/web`): React 19 + TS + Vite 8, React Router 7, Tailwind v4
(токены в `src/index.css` через `@theme`), Zustand (авторизация), TanStack Query
(данные с API), socket.io-client (realtime админки), vite-plugin-pwa. 3D-книга —
чистые CSS-трансформы (`components/Book.tsx`).

**Backend** (`apps/api`): NestJS 11 + TS, Prisma 7 + PostgreSQL (адаптер
`@prisma/adapter-pg`), argon2, @nestjs/jwt, @nestjs/throttler, nodemailer,
cookie-parser, @nestjs/websockets + socket.io, multer (загрузка фото), image-size.

**Инфраструктура:** Docker Compose (Postgres 17-alpine), npm workspaces. Запуск —
`npm start` из корня. Прод (план): российский VPS (152-ФЗ), Docker + Nginx/Caddy.

---

## 3. Структура репозитория

```
apps/
  web/src/
    components/    Nav, Footer, Book, Photo, Logo, Modal, Toast, FloatingCall,
                   Layout, ProtectedRoute, CookieBanner, ReviewModal
      auth/        AuthLayout, AuthBits, PhoneField
      admin/       ImageUpload
    pages/         Home, Catalog, Album, Contacts, Install, Constructor, Profile,
                   Pay (/pay/:token), Terms (/terms)
      auth/        Login, Register, Verify, ForgotPassword, ResetPassword,
                   FinishSetup, FinishProfile, OAuthCallback
      profile/     SecurityPage, ConnectionsPage, OrdersPage, ProfileSubLayout
      admin/       CategoriesTab, AlbumsTab, AlbumEditor
    domain/        types, demoData (ТОЛЬКО hero/reviews/about — альбомы теперь из БД),
                   pricing, useAbout
    lib/           api.ts (клиент + adminApi + showcaseApi + payApi), socket.ts,
                   session-return.ts, phone.ts, storage.ts
    store/         auth.ts (Zustand)
  api/
    prisma/        schema.prisma, migrations/, seed.ts, prisma.config.ts
    src/
      auth/        auth.service/controller, guards (jwt-auth, roles), decorators,
                   dto, oauth/, cookies.ts
      about/       about.controller (публичные данные фотографа)
      catalog/     catalog.controller (options: shootTypes+covers+categories для конструктора)
      orders/      orders.service/controller, dto  (POST /orders, GET /orders/mine)
      admin/       admin.service/controller, dto  (заказы, категории, обложки/виды для выбора)
      albums/      albums.service, albums.controller (/admin/albums),
                   public-albums.controller (/albums)
      images/      images.service/controller (/admin/images, загрузка/раздача)
      payments/    payments.service, pay.controller (/pay/:token)
      realtime/    orders.gateway (socket.io, комната admin), realtime.module
      mail/        mail.service (SMTP или консоль)
      common/      phone.ts, pricing.ts, slug.ts, storage.ts
      prisma/      prisma.service/module (Global)
      health/
docs/  handoff.md, Как-запустить.md, Установка-Mac-Windows.md, DEPLOY.md, stack.md,
       Что-прислать-и-как-получить.md (для владельца: ключи платежей/SMTP/OAuth,
       форматы фото для карусели/входа, промпт картинки входа)
Макет/  копия HTML-прототипа
docker-compose.yml (name: tuvafoto), package.json (workspaces + скрипты)
```

---

## 4. Что уже сделано

### Публичная часть
- Главная (hero-карусель, секция книг **из БД**, отзывы с модалкой, CTA, футер,
  плавающая кнопка звонка), каталог **из БД** (фильтр по категориям через `?cat=slug`,
  порядок категорий из админки), страница альбома **из БД** (3D-книга), контакты.
- **Book**: 3D-книга, перелистывание, автоплей, fullscreen (портал в body),
  **ориентация** (альбомная/книжная — через pw/ph) и **режим разворота**
  (SINGLE — одно фото; DOUBLE — два фото по страницам).
- PWA, адаптив до 320px, доступ с телефона (vite `host: true`).

### Авторизация и кабинет
- Вход/регистрация (маска телефона, 2FA с кулдауном), восстановление пароля,
  онбординг владельца (`/finish-setup` доступы → `/finish-profile` профиль). На
  `/finish-profile` теперь вводится **публичный email для футера** → пишется в
  `About.email` (фикс неверного email в футере).
- Профиль: карточка, разделы (Безопасность, Подключённые аккаунты, **Мои заказы**,
  Мои альбомы (заглушка), Админ-панель для владельца). `completeProfile` теперь
  обновляет и `User.name`/`User.phone` (фикс бага с именем).
- **Мои заказы** (`/profile/orders`): история, статус, кнопка «Доплатить» → `/pay/:token`.

### Конструктор
- Шаги: **1 Категория** (обязательна; от неё зависят виды съёмки и обложки) →
  Обложка (если категория разрешает) → Вид фотосессии (набор от категории) →
  Развороты. Sticky-сводка, live-расчёт. **«Готовые варианты» = реальные альбомы** с
  флагом `inConstructor` (`GET /albums/constructor`), показываются книгой; «Применить»
  подставляет категорию/виды/обложку/развороты (хардкод-пресетов больше нет).
- **Предоплата**: 20/30/40/50% / «Полная» / «Своя сумма» (≥20% от итога). Сервер
  считает и валидирует.
- **Обязательное согласие** с условиями (`/terms`) перед оплатой (галочка).
- **Оформление только для вошедших**: гость → сохраняем черновик в sessionStorage,
  уводим на вход, после входа возвращаем и восстанавливаем (`lib/session-return.ts`).
- «Добавить в конструктор» с `?album=<id>` — подставляет параметры альбома из БД.
- Мок-оплата: при оформлении `amountPaid = внесённая предоплата`; полная → «Оплачен».

### Админ-панель (`/admin`, `@Roles('OWNER')`)
- **Заказы**: список с составом и суммами, бейдж новых (realtime WebSocket + поллинг),
  отметка «прочитано» (клик по карточке + «прочитать все»). Телефон копируется по клику.
  **Управление статусом**: владелец может только **Отменить** (модалка «сколько
  вернуть», по умолчанию = внесённое) → «Ожидание возврата» → кнопка «Деньги
  возвращены» → «Деньги возвращены». В «Ожидает оплаты»: указать внесённую сумму
  (полная → «Оплачен») или сгенерировать **ссылку на доплату** `/pay/:token`.
- **Категории**: CRUD, drag-сортировка (ручка ⠿ + стрелки), порядок = порядок в
  каталоге. Для категории: «разрешить выбор обложки» + набор обложек + **набор видов
  съёмки** (обложки и виды съёмки привязаны к КАТЕГОРИИ).
- **Виды съёмки**: CRUD (`ShootTypesTab`), drag-сортировка, поля label/описание/цена/
  `isActive`. Выключенный вид скрыт в публичном конструкторе (`catalog/options` фильтрует
  `isActive`) и не предлагается в пикере категорий (но уже выбранный остаётся видимым).
  Удаление блокируется, если вид используется в заказах или альбомах (тогда только выключить).
- **Обложки**: CRUD (`CoversTab` + общий модал `CoverEditor`), drag-сортировка. Обложка =
  `CoverVariant`: **передняя картинка (обязательна) + задняя (опц.)** через `ImageUpload`,
  label, `priceMod`, `isActive`, **привязка к категориям** (M2M, редактируется с обеих сторон —
  и в категории, и в обложке). Выключенная скрыта в конструкторе и в подборе. Удаление
  блокируется, если обложка в заказах/альбомах. Конструктор теперь показывает реальные фото
  обложек (`catalog/options` отдаёт `imageUrl`/`backImageUrl`).
- **Альбомы**: CRUD, редактор. Обложка альбома выбирается **из готовых обложек категории**
  (превью-плитки, фильтр по выбранной категории; вариант «Без обложки») или создаётся тут же
  кнопкой «+ Создать обложку» (`CoverEditor`, привязка к текущей категории и другим). Альбом
  **ссылается** на обложку (`Album.coverVariantId`) — правка обложки отражается во всех
  альбомах; `coverUrl`/`backCoverUrl` витрины берутся из обложки (легаси `coverImageId`/
  `backCoverImageId` — фоллбэк для старых альбомов). Развороты SINGLE/DOUBLE с 1–2 фото через
  `ImageUpload`, «Опубликовать»/«На главной». Витрина показывает `isPublished`.
  **Количество разворотов НЕ вводится** — считается по числу добавленных разворотов
  (`spreadsCount = pages.length`, выводится на бэке во всех выборках). Флаг **«Готовый вариант
  в конструкторе»** (`Album.inConstructor`) делает альбом пресетом конструктора (нужна публикация).
- **О фотографе** (`AboutTab`): редактирование синглтона `About` — ФИО, роль, описание,
  телефон, **публичный email (футер)**, адрес, Telegram, VK, **MAX** (иконка в футере),
  **фото фотографа** через
  `ImageUpload` (`About.photoImageId`). Бэкенд `GET/PATCH /admin/about`; сохранение
  инвалидирует и публичный `['about']` (футер обновляется сразу). `GET /about` теперь
  отдаёт реальный `photoUrl` (раньше всегда `null`).
- **Готовые для клиента** (`ShareTab`, модуль `share/`): демо-альбом по секретной ссылке
  `/share/:token` для **оплаченного заказа**. Владелец выбирает PAID-заказ, собирает демо
  **с нуля** (обложки + развороты SINGLE/DOUBLE через `ImageUpload`). Выбор заказа —
  **поиск-пикер** (`OrderPicker`: по №/ФИО/телефону/email + диапазон номеров + карточки),
  не выпадающий список. Задаёт `expiresAt`
  (жизнь демо), опц. `diskUrl` + `downloadUntil`. Модель `ShareAlbum` (+`ShareSpread`) —
  **самодостаточный снимок**. Ссылка копируется и **появляется в истории заказа клиента**
  (`/orders/mine.shares`: просмотр + диск). Публичная `SharePage` — fullscreen `Book`.
  **Автоудаление:** по `expiresAt` тяжёлый контент (развороты + осиротевшие фото-файлы)
  вычищается (`setInterval` 15 мин + ленивая чистка при открытии), строка со ссылкой
  остаётся (`contentDeletedAt`); фото удаляются, только если больше нигде не используются.

### Платежи (мок)
- `/pay/:token` — публичная страница доплаты: данные заказа/заказчика/способ оплаты,
  заказчик сам вводит сумму; добор до итога → «Оплачен». `payToken` генерируется
  при создании заказа. Реальный провайдер не подключён.

### Загрузка изображений
- `POST /admin/images` (multer memory, лимит 15 МБ, JPG/PNG/WebP), размеры читаются
  из файла (`image-size`), файлы в `STORAGE_DIR` (`apps/api/uploads`, в git не идёт),
  раздача `/uploads` (`useStaticAssets`), vite проксирует `/uploads` и `/socket.io`.
  `GET /admin/images`, `DELETE /admin/images/:id`. Компонент `ImageUpload`.

### Backend прочее
- Заказы: `POST /orders` (сервер пересчитывает цену, валидирует обложку по категории,
  предоплату, требует `consent=true`, пишет `Consent` (152-ФЗ: версия+IP)), `GET /orders/mine`.
- Публичные: `GET /about`, `GET /catalog/options`, `GET /albums`(+`?category`),
  `GET /albums/featured`, `GET /albums/:id`.
- Сид (2026-07-21): **чистый старт без примеров** — только владелец (не дублируется)
  и блок «О фотографе». Категории/виды съёмки/обложки/альбомы владелец заводит сам.
  Демо-функции (`seedCategories/seedShootTypes/seedCoverVariants/seedCategoryCovers/
  seedAlbums`) в `seed.ts` сохранены, но не вызываются — вернуть примеры = дописать вызовы в `main()`.

### API-эндпоинты (префикс `/api`)
```
GET  /health · GET /about · GET /catalog/options
POST /orders · GET /orders/mine
GET  /albums (?category=slug) · GET /albums/featured · GET /albums/constructor · GET /albums/:id
GET  /share/:token  (публичное демо; после истечения — {expired:true})
POST /auth/register|login|verify|resend|refresh|logout|forgot-password|reset-password
POST /auth/change-password|change-credentials|complete-profile
GET  /auth/me|sessions · DELETE /auth/sessions/:id|sessions
GET  /auth/oauth/providers · GET /auth/oauth/:provider/start|callback
POST /auth/oauth/:provider/link · GET /auth/oauth/connections · DELETE /auth/oauth/:provider
--- admin (@Roles('OWNER')) ---
GET  /admin/orders · GET /admin/orders/unread-count
POST /admin/orders/read-all · /admin/orders/:id/read · /:id/set-paid · /:id/pay-link · /:id/cancel · /:id/refunded
GET  /admin/covers · /admin/shoot-types · /admin/categories
GET  /admin/about · PATCH /admin/about
GET  /admin/share · /admin/share/orders · POST /admin/share · DELETE /admin/share/:id
POST /admin/covers · /admin/covers/reorder · PATCH /admin/covers/:id · DELETE /admin/covers/:id
POST /admin/shoot-types · /admin/shoot-types/reorder · PATCH /admin/shoot-types/:id · DELETE /admin/shoot-types/:id
POST /admin/categories · /admin/categories/reorder · PATCH /admin/categories/:id · DELETE /admin/categories/:id
GET  /admin/albums · /admin/albums/:id · POST /admin/albums · PATCH/DELETE /admin/albums/:id
POST /admin/images · GET /admin/images · DELETE /admin/images/:id
--- pay (@Public) ---
GET  /pay/:token · POST /pay/:token
```

### Модели БД (Prisma)
User, OAuthAccount, Session, TwoFactorCode, PasswordResetToken, Image, Category
(+allowCover, M2M coverVariants, M2M shootTypes), ShootType, CoverVariant
(+imageId(front), backImageId(back), M2M categories, albums), Album
(+orientation, coverVariantId, inConstructor, coverImageId/backCoverImageId legacy;
spreadsCount выводится из pages), Spread
(+layout, imageId, rightImageId), HeroSlide, Order (+amountPaid, refundAmount, payToken,
prepayPercent, categoryId, shareAlbums), Review, About (+photoImageId),
ShareAlbum (снимок: orderId, token, orientation, coverImageId/backCoverImageId,
expiresAt, contentDeletedAt, diskUrl, downloadUntil), ShareSpread (layout/imageId/
rightImageId), Consent. About (+tg/vk/max/photoImageId).
Enum: Role, PayType(PREPAY/FULL), PayMethod, OrderStatus(PENDING/PAID/REFUND_PENDING/
REFUNDED/CANCELLED-legacy), ConsentKind, AlbumOrientation(LANDSCAPE/PORTRAIT),
SpreadLayout(SINGLE/DOUBLE).

Миграций 16 (init … share_album_snapshot, about_max).

---

## 5. Что дальше (осталось; приоритет сверху)

> **ВАЖНО: сначала пройтись по этому списку с пользователем и уточнить спорное.**
> Решения сессии 2026-07-20: (1) идём по порядку; (2) обложки **остаются привязаны
> к категории** (переделку на вид съёмки НЕ делаем); (3) демо для share хранится
> **снимком в `ShareAlbum`** (автоудаление демо не трогает каталожные `Album`).

1. ✅ **СДЕЛАНО (2026-07-20).** Раздел «Виды съёмки» в админке — CRUD + drag-сортировка
   (`ShootTypesTab`), бэкенд `admin/shoot-types` POST/reorder/PATCH/DELETE. См. раздел 4.

2. ✅ **СДЕЛАНО (2026-07-20).** Раздел «Обложки» в админке — CRUD с загрузкой передней+задней
   картинки, `priceMod`, `isActive`, привязка к категориям; drag-сортировка. Обложка альбома
   выбирается из готовых обложек категории или создаётся на месте; альбом ссылается на обложку
   (`Album.coverVariantId`). Конструктор показывает реальные фото обложек. Привязка осталась
   к КАТЕГОРИИ. См. раздел 4. ⚠️ У сид-обложек фото нет — владелец загружает их в админке.

3. ✅ **СДЕЛАНО (2026-07-20).** Раздел «О фотографе» в админке (`AboutTab`, `PATCH /admin/about`,
   все поля + фото) и фикс email в футере: на `/finish-profile` вводится публичный email →
   `About.email`; `GET /about` отдаёт реальный `photoUrl`. См. раздел 4.

4. ✅ **СДЕЛАНО (2026-07-20).** Раздел «Готовые альбомы для клиента» (share). Демо-снимок
   (`ShareAlbum`+`ShareSpread`) по оплаченному заказу, собирается с нуля; ссылка `/share/:token`
   (fullscreen `Book`), в истории заказа клиента (`/orders/mine.shares`), `diskUrl`+`downloadUntil`,
   автоудаление контента по `expiresAt` (`setInterval` + ленивая чистка). Вкладка `ShareTab`,
   модуль `share/`. См. раздел 4.

5. **Раздел «Примеры работ»** (ранее согласовано «и то, и другое»): галерея
   отдельных фото + витрина готовых альбомов. Витрина альбомов ≈ уже есть каталог;
   нужна **галерея фото** (новая модель `GalleryPhoto` или переиспользовать `Image`),
   загрузка через `ImageUpload`, публичный раздел + пункт меню.

6. **Хвосты**: реальные платежи (СБП QR/эквайринг + вебхуки — сейчас мок), реальный
   SMTP и ключи OAuth, отзывы в БД (модель `Review` есть, эндпоинтов нет), cookie/
   согласия полнее.

---

## 6. Правила и договорённости (ВАЖНО соблюдать)

**Безопасность и данные:**
- Пароли — argon2id. Refresh-токены, коды 2FA, токены сброса — sha256.
- Вход по паролю обязательно с 2FA (код на почту / в консоль на деве).
- Refresh — в httpOnly-куке `tf_refresh` (path `/api/auth`), ротируется при каждом
  обновлении. Access — в памяти клиента.
- JWT-гвард проверяет живость сессии в БД → отзыв/смена пароля действуют сразу.
- **Цену заказа и предоплату сервер всегда считает сам** из справочников БД. Формула
  дублируется: `apps/api/src/common/pricing.ts` и `apps/web/src/domain/pricing.ts` —
  держать синхронными.
- Все защищённые ручки закрыты по умолчанию (глобальный JwtAuthGuard); открываются
  явным `@Public()`. Админские — `@Roles('OWNER')`.
- Согласия 152-ФЗ пишутся с версией (`ORDER_TERMS_VERSION` в orders.service), IP, датой.
- Владелец один; при первом входе меняет доступы и заполняет профиль. Email в нижнем
  регистре (и в сиде). Телефон в E.164 (+79XXXXXXXXX).

**Процесс:**
- **Коммитит и пушит ТОЛЬКО пользователь сам.** Claude не коммитит. Автор — Filipp.
  Репозиторий: `github.com/sobolev-filipp/-`.
- Отвечать и писать тексты — **на русском**.
- **Верифицировать изменения в браузере**, не только typecheck. **Бэкенд — скриптом
  через живой API** (см. раздел 9).
- Дизайн-токены — только в `apps/web/src/index.css` (`@theme`).
- Комментарии объясняют «почему», а не «что».

---

## 7. Подводные камни

- **Docker Desktop выключается между сессиями.** Перед работой с БД — запустить
  (Win: `Docker Desktop.exe`; Mac: `open -a Docker`), дождаться `docker ps`.
- **Prisma 7:** строка подключения в `prisma.config.ts` (не в schema), клиент через
  `@prisma/adapter-pg`.
- **`prisma migrate dev` НЕ работает неинтерактивно** в этой среде (падает
  «environment is non-interactive»). Поэтому миграции **создаём вручную**: папка
  `prisma/migrations/<timestamp>_<name>/migration.sql`, затем `npx prisma migrate
  deploy`. Приёмы: переименование enum-значения — `ALTER TYPE .. RENAME VALUE`;
  добавление значения — `ALTER TYPE .. ADD VALUE`; неявная M2M — скопировать DDL
  `_AToB` из init-миграции (PK (A,B) + B-index + два FK CASCADE; A/B по алфавиту имён).
  После миграции — `npx prisma generate`.
- **`prisma generate` обязателен перед стартом/сидом.** Уже добавлен в `npm run setup`
  (`generate → db:up → migrate → seed`) и в `dev:api` (`prisma generate && prisma
  migrate deploy && nest start --watch`). На чистой БД без миграций сид падает
  `P2021 table does not exist`.
- **Новые Node (26)/npm блокируют install-скрипты** (`allow-scripts`) → не собирается
  нативный `argon2`, движки Prisma. Решение: Node 22 LTS **или** `npm approve-scripts
  --allow-scripts-pending` + `npm install`. Подробно — `docs/Установка-Mac-Windows.md`.
- **Mac:** в `pwsh` пути через `/` (обратный слэш не резолвится). `.env` создавать
  `cp apps/api/.env.example apps/api/.env`.
- **Имя папки кириллицей** ломает Docker Compose → в compose жёстко `name: tuvafoto`.
- **Copy-Item .env.example → .env** затирает .env — только через проверку существования.
- **React StrictMode** дважды вызывает эффекты → bootstrap авторизации/OAuth дедуплен.
- **Book свёрстан в px**, считает размер по `documentElement.clientWidth`; fullscreen —
  портал в body. z-index: бургер-меню (overlay 71, drawer 72) выше cookie-баннера (70).
- **Сид не плодит дубль-владельца** (создаёт, только если владельца нет вообще).
- **Диалоги подтверждения/ошибок — попапы**, а не нативные `alert`/`confirm`. Общий
  компонент `components/ConfirmDialog.tsx` (используется во всех admin-вкладках для удаления).
- **CoverEditor**: фото передней обложки обязательно **только при создании** обложки; при
  редактировании (в т.ч. чтобы выключить старую обложку без фото) сохранять можно без фото.

---

## 8. Как запустить

Полные инструкции: `docs/Как-запустить.md` (Windows) и `docs/Установка-Mac-Windows.md`
(с нуля, Mac+Windows). Кратко (Docker запущен, из корня):
```
npm run setup      # первый раз: deps + generate + db:up + migrate + seed
npm start          # база + оба сервера (API 3000, web 5173)
npm run db:reset   # сброс БД к заводскому (интерактивно, спросит y)
```
Сайт http://localhost:5173 · Health http://localhost:3000/api/health

При старте dev-сервера Vite печатает баннер с адресами: локальный (`localhost:5173`)
и сетевые (`http://<IP>:5173` — открыть с телефона в той же Wi-Fi). Плагин
`startupBanner` в `apps/web/vite.config.ts`; сетевой доступ включён `host: true`.
**Вход владельца (после сброса):** `Tuvafoto@mail.ru` / `TuvaFoto-2026` (временный;
при первом входе — 2FA код в консоли `[API]`, затем смена доступов и профиль).
> Текущий реальный владелец в dev-БД — `filipp.sobolev1999@gmail.com` (пароль задан
> пользователем). Для чистого старта — `npm run db:reset`.

---

## 9. Как тестировать (приёмы этой сессии)

- **Бэкенд — скриптом через живой API** (Node CJS в scratchpad, запуск с
  `NODE_PATH=<repo>/node_modules`, модули `pg`+`jsonwebtoken` из корня).
  OWNER-токен минтим: вставить строку `Session` (id=sid, tokenHash=любой, expiresAt
  в будущем), подписать JWT `{sub, role:'OWNER', sid}` секретом `JWT_ACCESS_SECRET`
  (dev: `dev-only-change-me-access`). Публичный `POST /orders` — без токена.
  **Уборка: удалять ТОЛЬКО свои тест-сессии по их id.** НИКОГДА не удалять все
  сессии владельца (`DELETE ... WHERE userId=owner`) — это разлогинит реального
  пользователя (был такой инцидент).
- **Логин владельцем в автоматизированном браузере** (без пароля/2FA): создать
  `Session` с `tokenHash=sha256(token)`, в браузере `fetch('/api/auth/logout')` +
  истечь старые `tf_refresh` (path `/` и `/api/auth`), поставить `document.cookie =
  "tf_refresh=<token>; path=/api/auth"`, затем `fetch('/api/auth/refresh')` (200) и
  **жёсткая перезагрузка** `/admin` (bootstrap подхватит). Старые куки после ротации
  невалидны — обязательно чистить. Тест-сессии удалять по `id LIKE 'sess_browser_%'`.
- **Скриншоты preview-браузера в этой среде капризничают** (таймауты) — использовать
  `get_page_text` / `read_page` / `javascript_tool` вместо `screenshot`.
- **Clipboard в автоматизации заблокирован** (нет доверенного жеста) — копирование
  телефона/ссылок в тесте показывает «не удалось», в реальном браузере на localhost
  работает.

---

## 10. Известные баги / открытые вопросы

- ~~**Email в футере неверный**~~ РЕШЕНО (2026-07-20): `About.email` вводится на
  `/finish-profile` и правится в админке («О фотографе»).
- ~~**Обложки: категория или вид съёмки?**~~ РЕШЕНО (2026-07-20): остаётся привязка к
  категории. См. п.2 раздела 5.
- ~~**Пресеты конструктора**~~ РЕШЕНО (2026-07-20): пресеты теперь = реальные альбомы с
  флагом `inConstructor`; «Применить» фильтрует виды/обложку по категории альбома.
- `demoData.ts` теперь используется только для hero-слайдов, отзывов и (частично)
  about; массивы `albums/categories/shootTypes/coverVariants` больше не читаются
  витриной (можно вычистить при желании).
</content>
