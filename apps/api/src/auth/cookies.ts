import type { ConfigService } from '@nestjs/config'
import type { Response } from 'express'

/** Имя куки с refresh-токеном. */
export const REFRESH_COOKIE = 'tf_refresh'

/**
 * Refresh живёт в httpOnly-куке, а не в localStorage: до httpOnly-куки не
 * дотянется скрипт со страницы, поэтому XSS не уносит долгоживущий токен.
 * path ограничен /api/auth — куку не шлём на каждый запрос подряд.
 */
export function setRefreshCookie(
  res: Response,
  config: ConfigService,
  token: string,
  maxAgeMs: number,
) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.get('NODE_ENV') === 'production',
    path: '/api/auth',
    maxAge: maxAgeMs,
  })
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' })
}
