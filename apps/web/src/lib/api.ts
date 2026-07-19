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

  const send = () =>
    fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
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
      coverVariants: { id: string; label: string; priceMod: number; imageUrl: string | null }[]
    }>('/catalog/options', { skipRefresh: true }),

  createOrder: (body: {
    fio: string
    school: string
    phone: string
    coverVariantId?: string | null
    shootTypeIds: string[]
    spreads: number
    payType: 'PREPAY' | 'FULL'
    prepayPercent?: number
    prepayAmount?: number
    payMethod?: 'SBP' | 'BANK'
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

  completeProfile: (body: { fio: string; address: string; phone: string }) =>
    api<{ user: ApiUser }>('/auth/complete-profile', { method: 'POST', body }),

  sessions: () => api<ApiSession[]>('/auth/sessions'),

  revokeSession: (id: string) => api<{ ok: boolean }>(`/auth/sessions/${id}`, { method: 'DELETE' }),

  revokeOthers: () => api<{ revoked: number }>('/auth/sessions', { method: 'DELETE' }),
}
