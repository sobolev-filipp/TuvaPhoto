import { ConflictException, Controller, Delete, Get, Param, Post, Query, Req, Res } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import { AuthService } from '../auth.service'
import { OAuthService } from './oauth.service'
import { Public } from '../decorators/public.decorator'
import { CurrentUser } from '../decorators/current-user.decorator'
import type { AccessPayload } from '../auth.service'
import { setRefreshCookie } from '../cookies'

/** Кука с одноразовым state — защита от CSRF на коллбэке. */
const STATE_COOKIE = 'tf_oauth_state'
const STATE_TTL_MS = 10 * 60 * 1000

/**
 * state-кука кодирует режим:
 *   login:<provider>:<state>           — вход/регистрация
 *   link:<provider>:<userId>:<state>   — привязка к вошедшему пользователю
 * Кука httpOnly и ставится сервером, поэтому userId в ней можно доверять.
 */
@Controller('auth/oauth')
export class OAuthController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private webOrigin() {
    return this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173'
  }

  private setState(res: Response, value: string) {
    res.cookie(STATE_COOKIE, value, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('NODE_ENV') === 'production',
      path: '/api/auth/oauth',
      maxAge: STATE_TTL_MS,
    })
  }

  private meta(req: Request) {
    return { ip: req.ip, userAgent: req.headers['user-agent']?.slice(0, 300) }
  }

  /* --------------------------------------------------------- публичное */

  /** Список включённых провайдеров — фронт рисует кнопки по нему. */
  @Public()
  @Get('providers')
  providers() {
    return this.oauth.listEnabled()
  }

  /** Старт входа: кладём state в куку и уводим к провайдеру. */
  @Public()
  @Get(':provider/start')
  start(@Param('provider') provider: string, @Res({ passthrough: true }) res: Response) {
    const state = randomBytes(16).toString('base64url')
    const url = this.oauth.authorizeUrl(provider, state)
    this.setState(res, `login:${provider}:${state}`)
    res.redirect(url)
  }

  /* --------------------------------------------------------- привязка */

  /**
   * Старт привязки к текущему аккаунту. Требует авторизации, поэтому это POST
   * (Bearer нельзя передать полной навигацией) — возвращаем URL, а редирект
   * делает фронт через window.location.
   */
  @Post(':provider/link')
  linkStart(
    @Param('provider') provider: string,
    @CurrentUser() payload: AccessPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    const state = randomBytes(16).toString('base64url')
    const url = this.oauth.authorizeUrl(provider, state)
    this.setState(res, `link:${provider}:${payload.sub}:${state}`)
    return { url }
  }

  /** Что подключено и что доступно. */
  @Get('connections')
  connections(@CurrentUser() payload: AccessPayload) {
    return this.oauth.connections(payload.sub)
  }

  /** Отвязать провайдера. */
  @Delete(':provider')
  async unlink(@Param('provider') provider: string, @CurrentUser() payload: AccessPayload) {
    await this.oauth.unlink(payload.sub, provider)
    return { ok: true }
  }

  /* --------------------------------------------------------- коллбэк */

  /**
   * Коллбэк провайдера. Любая осечка уводит на страницу с пометкой — после
   * редиректа со стороннего сайта пользователь не должен увидеть голую 500.
   */
  @Public()
  @Get(':provider/callback')
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const saved = req.cookies?.[STATE_COOKIE] as string | undefined
    // state одноразовый — гасим сразу, чтобы коллбэк нельзя было переиграть.
    res.clearCookie(STATE_COOKIE, { path: '/api/auth/oauth' })

    const parts = saved?.split(':') ?? []
    const mode = parts[0]
    const isLink = mode === 'link'
    const back = isLink ? '/profile/connections' : '/login'
    const fail = (reason: string) =>
      res.redirect(`${this.webOrigin()}${back}?oauth_error=${encodeURIComponent(reason)}`)

    if (error) return fail('provider')
    if (!code || !state) return fail('no_code')

    try {
      if (isLink) {
        // link:<provider>:<userId>:<state>
        const [, cProvider, userId, cState] = parts
        if (cProvider !== provider || cState !== state) return fail('state')
        await this.oauth.linkToUser(provider, code, userId)
        return res.redirect(`${this.webOrigin()}/profile/connections?linked=${provider}`)
      }

      // login:<provider>:<state>
      if (saved !== `login:${provider}:${state}`) return fail('state')
      const user = await this.oauth.resolveUser(provider, code)
      const { refreshToken } = await this.auth.issueSessionForUser(
        user.id,
        user.role,
        this.meta(req),
      )
      setRefreshCookie(res, this.config, refreshToken, this.auth.sessionTtlMs())
      // Фронт на /oauth/callback вызовет refresh по свежей куке и подхватит сессию.
      return res.redirect(`${this.webOrigin()}/oauth/callback`)
    } catch (e) {
      // Привязка чужого аккаунта — покажем понятную причину.
      return fail(e instanceof ConflictException ? 'already_linked' : 'exchange')
    }
  }
}
