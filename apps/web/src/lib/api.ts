/**
 * Клиент API.
 *
 * Access-токен живёт только в памяти (см. store/auth): в localStorage его
 * достал бы любой скрипт со страницы. Долгоживущий refresh лежит в httpOnly-куке,
 * поэтому после перезагрузки вкладки сессия восстанавливается запросом
 * /auth/refresh, а не чтением токена из хранилища.
 */

export class ApiError extends Error {
  status: number
  data?: unknown

  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

let accessToken: string | null = null
/** Вызывается, когда сессия окончательно протухла. */
let onUnauthorized: (() => void) | null = null

export const setAccessToken = (token: string | null) => {
  accessToken = token
}
export const getAccessToken = () => accessToken
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Не пытаться обновить токен при 401 (иначе refresh зациклится сам на себя). */
  skipRefresh?: boolean
}

async function parse(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** Достаёт человекочитаемую ошибку: Nest кладёт её в message (строкой или массивом). */
function messageOf(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const m = (data as { message: unknown }).message
    if (Array.isArray(m)) return m.join('. ')
    if (typeof m === 'string') return m
  }
  return fallback
}

/** Обновление токена: параллельные 401 должны ждать один запрос, а не слать N. */
let refreshing: Promise<boolean> | null = null

async function refreshToken(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      if (!res.ok) return false
      const data = (await res.json()) as { accessToken: string }
      accessToken = data.accessToken
      return true
    } catch {
      return false
    } finally {
      // Сбрасываем в микротаске, чтобы все ждущие успели прочитать результат.
      queueMicrotask(() => {
        refreshing = null
      })
    }
  })()
  return refreshing
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, skipRefresh = false } = options

  // FormData отправляем как есть: content-type с boundary проставит браузер сам,
  // JSON.stringify тут ломает загрузку файла.
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData

  const send = () =>
    fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body && !isForm ? { 'content-type': 'application/json' } : {}),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined,
    })

  let res = await send()

  // Access живёт 15 минут: истёк — молча продлеваем и повторяем запрос один раз.
  if (res.status === 401 && !skipRefresh) {
    const ok = await refreshToken()
    if (ok) {
      res = await send()
    } else {
      accessToken = null
      onUnauthorized?.()
    }
  }

  const data = await parse(res)

  if (!res.ok) {
    throw new ApiError(res.status, messageOf(data, `Ошибка ${res.status}`), data)
  }

  return data as T
}

/* ------------------------------------------------------------- типы API */

export interface ApiUser {
  id: string
  name: string
  email: string
  role: 'CLIENT' | 'OWNER'
  phone: string | null
  /** Пока true — нужно сменить временные логин и пароль. */
  mustChangeCredentials: boolean
  /** Пока true — владелец должен заполнить данные о себе (ФИО/адрес/телефон). */
  mustCompleteProfile: boolean
}

export interface OAuthProviderInfo {
  key: 'yandex' | 'vk'
  name: string
}

export interface ChallengeResponse {
  challengeId: string
  email: string
  next: 'verify'
}

export interface AuthResponse {
  accessToken: string
  user: ApiUser
}

export interface ApiSession {
  id: string
  ip: string | null
  userAgent: string | null
  createdAt: string
  lastSeenAt: string
  current: boolean
}

export interface ApiConnection {
  key: 'yandex' | 'vk'
  name: string
  linked: boolean
  linkedAt: string | null
}

export type OrderStatus = 'PENDING' | 'PAID' | 'REFUND_PENDING' | 'REFUNDED' | 'CANCELLED'

/** Заказ в админке — состав и суммы, как их отдаёт GET /admin/orders. */
export interface ApiAdminOrder {
  id: string
  number: number
  fio: string
  school: string
  phone: string
  spreadsCount: number
  perSpread: number
  priceShoots: number
  priceSpreads: number
  priceCover: number
  total: number
  amountDue: number
  /** Сколько заказчик уже внёс. */
  amountPaid: number
  /** Сумма к возврату (после отмены). */
  refundAmount: number | null
  /** Токен ссылки на доплату, если сгенерирована. */
  payToken: string | null
  payType: 'PREPAY' | 'FULL'
  /** Процент предоплаты для пресета; null — своя сумма или полная оплата. */
  prepayPercent: number | null
  payMethod: 'SBP' | 'BANK' | null
  status: OrderStatus
  readAt: string | null
  createdAt: string
  category: { name: string } | null
  coverVariant: { label: string } | null
  shootTypes: { label: string }[]
}

/** Куда браузер уходит к провайдеру. Полная навигация, не fetch. */
export const oauthStartUrl = (provider: string) => `/api/auth/oauth/${provider}/start`

export const adminApi = {
  orders: () => api<ApiAdminOrder[]>('/admin/orders'),

  unreadCount: () => api<{ count: number }>('/admin/orders/unread-count'),

  markRead: (id: string) => api<{ ok: boolean }>(`/admin/orders/${id}/read`, { method: 'POST' }),

  markAllRead: () => api<{ read: number }>('/admin/orders/read-all', { method: 'POST' }),

  /** Указать внесённую заказчиком сумму (полная → «Оплачен»). */
  setPaid: (id: string, amountPaid: number) =>
    api<{ ok: boolean }>(`/admin/orders/${id}/set-paid`, { method: 'POST', body: { amountPaid } }),

  /** Сгенерировать/получить ссылку на доплату. */
  payLink: (id: string) =>
    api<{ token: string; path: string }>(`/admin/orders/${id}/pay-link`, { method: 'POST' }),

  /** Отменить заказ → ожидание возврата (с суммой к возврату). */
  cancel: (id: string, refundAmount: number) =>
    api<{ ok: boolean }>(`/admin/orders/${id}/cancel`, { method: 'POST', body: { refundAmount } }),

  /** Подтвердить возврат средств → «Деньги возвращены». */
  refunded: (id: string) =>
    api<{ ok: boolean }>(`/admin/orders/${id}/refunded`, { method: 'POST' }),

  // --- Категории ↔ обложки/виды съёмки ---
  covers: () => api<AdminCover[]>('/admin/covers'),
  createCover: (body: AdminCoverInput) =>
    api<{ id: string }>('/admin/covers', { method: 'POST', body }),
  reorderCovers: (ids: string[]) =>
    api<{ ok: boolean }>('/admin/covers/reorder', { method: 'POST', body: { ids } }),
  updateCover: (id: string, body: Partial<AdminCoverInput>) =>
    api<{ ok: boolean }>(`/admin/covers/${id}`, { method: 'PATCH', body }),
  deleteCover: (id: string) =>
    api<{ ok: boolean }>(`/admin/covers/${id}`, { method: 'DELETE' }),
  shootTypes: () => api<AdminShootType[]>('/admin/shoot-types'),
  createShootType: (body: AdminShootTypeInput) =>
    api<{ id: string }>('/admin/shoot-types', { method: 'POST', body }),
  reorderShootTypes: (ids: string[]) =>
    api<{ ok: boolean }>('/admin/shoot-types/reorder', { method: 'POST', body: { ids } }),
  updateShootType: (id: string, body: Partial<AdminShootTypeInput>) =>
    api<{ ok: boolean }>(`/admin/shoot-types/${id}`, { method: 'PATCH', body }),
  deleteShootType: (id: string) =>
    api<{ ok: boolean }>(`/admin/shoot-types/${id}`, { method: 'DELETE' }),
  categories: () => api<AdminCategory[]>('/admin/categories'),
  createCategory: (body: AdminCategoryInput) =>
    api<{ id: string }>('/admin/categories', { method: 'POST', body }),
  reorderCategories: (ids: string[]) =>
    api<{ ok: boolean }>('/admin/categories/reorder', { method: 'POST', body: { ids } }),
  updateCategory: (id: string, body: Partial<AdminCategoryInput>) =>
    api<{ ok: boolean }>(`/admin/categories/${id}`, { method: 'PATCH', body }),
  deleteCategory: (id: string) =>
    api<{ ok: boolean }>(`/admin/categories/${id}`, { method: 'DELETE' }),

  // --- Изображения ---
  images: () => api<UploadedImageInfo[]>('/admin/images'),
  uploadImage: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api<UploadedImageInfo>('/admin/images', { method: 'POST', body: form })
  },
  deleteImage: (id: string) => api<{ ok: boolean }>(`/admin/images/${id}`, { method: 'DELETE' }),

  // --- Альбомы ---
  albums: () => api<AdminAlbumListItem[]>('/admin/albums'),
  album: (id: string) => api<AdminAlbumFull>(`/admin/albums/${id}`),
  createAlbum: (body: AlbumInput) => api<{ id: string }>('/admin/albums', { method: 'POST', body }),
  updateAlbum: (id: string, body: AlbumInput) =>
    api<{ ok: boolean }>(`/admin/albums/${id}`, { method: 'PATCH', body }),
  deleteAlbum: (id: string) => api<{ ok: boolean }>(`/admin/albums/${id}`, { method: 'DELETE' }),

  // --- О фотографе ---
  about: () => api<AdminAbout>('/admin/about'),
  updateAbout: (body: AdminAboutInput) =>
    api<{ ok: boolean }>('/admin/about', { method: 'PATCH', body }),

  // --- Демо-альбомы для клиента (share) ---
  sharePaidOrders: () => api<SharePaidOrder[]>('/admin/share/orders'),
  shares: () => api<AdminShare[]>('/admin/share'),
  createShare: (body: CreateShareInput) =>
    api<{ id: string; token: string; path: string }>('/admin/share', { method: 'POST', body }),
  deleteShare: (id: string) => api<{ ok: boolean }>(`/admin/share/${id}`, { method: 'DELETE' }),
}

/** Оплаченный заказ для выбора при создании демо-ссылки. */
export interface SharePaidOrder {
  id: string
  number: number
  fio: string
  school: string
  phone: string
  email: string | null
  total: number
  createdAt: string
}

/** Демо-ссылка в списке админки. */
export interface AdminShare {
  id: string
  token: string
  path: string
  title: string
  subtitle: string
  orderNumber: number
  orderFio: string
  expiresAt: string
  expired: boolean
  contentDeleted: boolean
  diskUrl: string | null
  downloadUntil: string | null
  spreadsCount: number
  coverUrl: string | null
  createdAt: string
}

/** Тело создания демо-ссылки. */
export interface CreateShareInput {
  orderId: string
  title: string
  subtitle?: string
  orientation: AlbumOrientation
  coverImageId?: string | null
  backCoverImageId?: string | null
  spreads: {
    label?: string
    layout: SpreadLayout
    imageId?: string | null
    rightImageId?: string | null
  }[]
  expiresAt: string
  diskUrl?: string | null
  downloadUntil?: string | null
}

/** Блок «О фотографе» для редактора в админке. */
export interface AdminAbout {
  fio: string
  role: string
  desc: string
  phone: string
  email: string
  address: string
  tg: string
  vk: string
  max: string
  photoImageId: string | null
  photoUrl: string | null
}

/** Тело обновления «О фотографе». */
export interface AdminAboutInput {
  fio: string
  role: string
  desc: string
  phone: string
  email: string
  address: string
  tg: string
  vk: string
  max: string
  photoImageId?: string | null
}

export type AlbumOrientation = 'LANDSCAPE' | 'PORTRAIT'
export type SpreadLayout = 'SINGLE' | 'DOUBLE'

export interface AdminAlbumListItem {
  id: string
  name: string
  orientation: AlbumOrientation
  price: number
  isPublished: boolean
  isFeatured: boolean
  category: string
  coverUrl: string | null
  spreadsCount: number
}

/** Ссылка на изображение в ответах альбома. */
export interface AlbumImageRef {
  id: string
  url: string
}

export interface AdminAlbumFull {
  id: string
  name: string
  subtitle: string
  desc: string
  categoryId: string
  shootTypeIds: string[]
  orientation: AlbumOrientation
  spreadsCount: number
  minSpreads: number
  maxSpreads: number
  perSpread: number
  price: number
  format: string
  isPublished: boolean
  isFeatured: boolean
  inConstructor: boolean
  sortOrder: number
  coverVariantId: string | null
  cover: AlbumImageRef | null
  backCover: AlbumImageRef | null
  spreads: {
    label: string
    layout: SpreadLayout
    image: AlbumImageRef | null
    rightImage: AlbumImageRef | null
  }[]
}

/** Тело создания/обновления альбома (совпадает с UpsertAlbumDto на бэке). */
export interface AlbumInput {
  name: string
  subtitle?: string
  desc?: string
  categoryId: string
  shootTypeIds: string[]
  orientation: AlbumOrientation
  minSpreads: number
  maxSpreads: number
  perSpread: number
  price: number
  format?: string
  coverVariantId?: string | null
  coverImageId?: string | null
  backCoverImageId?: string | null
  isPublished: boolean
  isFeatured: boolean
  inConstructor?: boolean
  sortOrder?: number
  spreads: {
    label?: string
    layout: SpreadLayout
    imageId?: string | null
    rightImageId?: string | null
  }[]
}

export interface UploadedImageInfo {
  id: string
  url: string
  width: number
  height: number
}

export interface AdminCover {
  id: string
  label: string
  priceMod: number
  isActive: boolean
  sortOrder: number
  imageId: string | null
  backImageId: string | null
  imageUrl: string | null
  backImageUrl: string | null
  categoryIds: string[]
}

/** Тело создания/обновления обложки. */
export interface AdminCoverInput {
  label: string
  priceMod: number
  imageId: string
  backImageId?: string | null
  isActive: boolean
  categoryIds: string[]
}

export interface AdminShootType {
  id: string
  label: string
  description: string
  price: number
  isActive: boolean
  sortOrder: number
}

/** Тело создания/обновления вида съёмки. */
export interface AdminShootTypeInput {
  label: string
  description: string
  price: number
  isActive: boolean
}

export interface AdminCategory {
  id: string
  name: string
  slug: string
  sortOrder: number
  allowCover: boolean
  coverVariantIds: string[]
  shootTypeIds: string[]
}

export interface AdminCategoryInput {
  name: string
  allowCover: boolean
  coverVariantIds: string[]
  shootTypeIds: string[]
}

/* ------------------------------------------------- публичная витрина альбомов */

export interface PublicAlbumListItem {
  id: string
  name: string
  subtitle: string
  orientation: 'LANDSCAPE' | 'PORTRAIT'
  spreadsCount: number
  price: number
  format: string
  categoryName: string
  categorySlug: string
  coverUrl: string | null
  shootTypes: string[]
}

export interface PublicAlbumFull {
  id: string
  name: string
  subtitle: string
  desc: string
  orientation: 'LANDSCAPE' | 'PORTRAIT'
  spreadsCount: number
  minSpreads: number
  maxSpreads: number
  perSpread: number
  price: number
  format: string
  categoryName: string
  categorySlug: string
  shootTypes: string[]
  coverVariantId: string | null
  coverUrl: string | null
  backCoverUrl: string | null
  spreads: {
    label: string
    layout: 'SINGLE' | 'DOUBLE'
    imageUrl: string | null
    rightImageUrl: string | null
  }[]
}

export const showcaseApi = {
  albums: (categorySlug?: string) =>
    api<PublicAlbumListItem[]>(
      `/albums${categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : ''}`,
      { skipRefresh: true },
    ),
  featured: () => api<PublicAlbumFull[]>('/albums/featured', { skipRefresh: true }),
  constructorAlbums: () => api<PublicAlbumFull[]>('/albums/constructor', { skipRefresh: true }),
  album: (id: string) => api<PublicAlbumFull>(`/albums/${id}`, { skipRefresh: true }),
}

/* ----------------------------------------------- демо-альбомы по ссылке (share) */

/** Демо по ссылке /share/:token. После истечения отдаётся только `expired`. */
export type PublicShare =
  | { expired: true; title: string; subtitle: string }
  | {
      expired: false
      title: string
      subtitle: string
      orientation: 'LANDSCAPE' | 'PORTRAIT'
      coverUrl: string | null
      backCoverUrl: string | null
      expiresAt: string
      spreads: {
        label: string
        layout: 'SINGLE' | 'DOUBLE'
        imageUrl: string | null
        rightImageUrl: string | null
      }[]
    }

export const shareApi = {
  get: (token: string) => api<PublicShare>(`/share/${token}`, { skipRefresh: true }),
}

/** Заказ в истории личного кабинета. */
export interface ApiMyOrder {
  number: number
  status: OrderStatus
  total: number
  amountPaid: number
  remaining: number
  amountDue: number
  payType: 'PREPAY' | 'FULL'
  prepayPercent: number | null
  /** Токен для доплаты; null, если доплата уже не нужна. */
  payToken: string | null
  createdAt: string
  category: string | null
  cover: string | null
  shootTypes: string[]
  /** Готовые демо-альбомы по заказу: ссылка на просмотр и на диск. */
  shares: {
    title: string
    path: string
    expiresAt: string
    expired: boolean
    diskUrl: string | null
    downloadUntil: string | null
  }[]
}

export const ordersApi = {
  /** История заказов текущего пользователя. */
  mine: () => api<ApiMyOrder[]>('/orders/mine'),
}

/** Публичная страница доплаты /pay/:token — данные заказа и сама оплата. */
export interface ApiPayOrder {
  number: number
  fio: string
  school: string
  phone: string
  total: number
  amountPaid: number
  remaining: number
  payMethod: 'SBP' | 'BANK' | null
  status: OrderStatus
  category: string | null
  cover: string | null
  shootTypes: string[]
}

export const payApi = {
  get: (token: string) => api<ApiPayOrder>(`/pay/${token}`, { skipRefresh: true }),

  pay: (token: string, amount: number) =>
    api<{ amountPaid: number; remaining: number; paidInFull: boolean }>(`/pay/${token}`, {
      method: 'POST',
      body: { amount },
      skipRefresh: true,
    }),
}

export const authApi = {
  register: (body: {
    name: string
    email: string
    phone: string
    password: string
    consent: boolean
  }) => api<ChallengeResponse>('/auth/register', { method: 'POST', body }),

  oauthProviders: () => api<OAuthProviderInfo[]>('/auth/oauth/providers', { skipRefresh: true }),

  login: (body: { email: string; password: string; consent: boolean }) =>
    api<ChallengeResponse>('/auth/login', { method: 'POST', body }),

  verify: (body: { challengeId: string; code: string }) =>
    api<AuthResponse>('/auth/verify', { method: 'POST', body }),

  resendCode: (body: { challengeId: string }) =>
    api<{ cooldown: number }>('/auth/resend', { method: 'POST', body }),

  forgotPassword: (body: { email: string }) =>
    api<{ ok: boolean; message: string }>('/auth/forgot-password', { method: 'POST', body }),

  resetPassword: (body: { token: string; newPassword: string }) =>
    api<{ ok: boolean }>('/auth/reset-password', { method: 'POST', body }),

  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    api<{ ok: boolean }>('/auth/change-password', { method: 'POST', body }),

  connections: () => api<ApiConnection[]>('/auth/oauth/connections'),

  catalogOptions: () =>
    api<{
      shootTypes: { id: string; label: string; description: string; price: number }[]
      coverVariants: {
        id: string
        label: string
        priceMod: number
        imageUrl: string | null
        backImageUrl: string | null
      }[]
      categories: {
        id: string
        name: string
        slug: string
        allowCover: boolean
        coverVariantIds: string[]
        shootTypeIds: string[]
      }[]
    }>('/catalog/options', { skipRefresh: true }),

  createOrder: (body: {
    fio: string
    school: string
    phone: string
    categoryId?: string | null
    coverVariantId?: string | null
    shootTypeIds: string[]
    spreads: number
    payType: 'PREPAY' | 'FULL'
    prepayPercent?: number
    prepayAmount?: number
    payMethod?: 'SBP' | 'BANK'
    consent: boolean
  }) => api<{ number: number; total: number; amountDue: number }>('/orders', { method: 'POST', body }),

  linkOAuth: (provider: string) =>
    api<{ url: string }>(`/auth/oauth/${provider}/link`, { method: 'POST' }),

  unlinkOAuth: (provider: string) =>
    api<{ ok: boolean }>(`/auth/oauth/${provider}`, { method: 'DELETE' }),

  // skipRefresh: этот запрос сам и есть обновление сессии.
  refresh: () => api<AuthResponse>('/auth/refresh', { method: 'POST', skipRefresh: true }),

  logout: () => api<{ ok: boolean }>('/auth/logout', { method: 'POST', skipRefresh: true }),

  me: () => api<ApiUser>('/auth/me'),

  changeCredentials: (body: { currentPassword: string; newEmail: string; newPassword: string }) =>
    api<{ user: ApiUser }>('/auth/change-credentials', { method: 'POST', body }),

  completeProfile: (body: { fio: string; address: string; phone: string; email: string }) =>
    api<{ user: ApiUser }>('/auth/complete-profile', { method: 'POST', body }),

  sessions: () => api<ApiSession[]>('/auth/sessions'),

  revokeSession: (id: string) => api<{ ok: boolean }>(`/auth/sessions/${id}`, { method: 'DELETE' }),

  revokeOthers: () => api<{ revoked: number }>('/auth/sessions', { method: 'DELETE' }),
}
