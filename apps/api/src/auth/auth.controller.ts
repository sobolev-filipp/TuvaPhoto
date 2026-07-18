import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Throttle } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import { AuthService, type RequestMeta } from './auth.service'
import {
  ChangeCredentialsDto,
  ChangePasswordDto,
  CompleteProfileDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyDto,
} from './dto/auth.dto'
import { Roles } from './guards/roles.guard'
import { Public } from './decorators/public.decorator'
import { CurrentUser } from './decorators/current-user.decorator'
import type { AccessPayload } from './auth.service'
import { REFRESH_COOKIE, clearRefreshCookie, setRefreshCookie } from './cookies'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private meta(req: Request): RequestMeta {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent']?.slice(0, 300),
    }
  }

  private setRefreshCookie(res: Response, token: string) {
    setRefreshCookie(res, this.config, token, this.auth.sessionTtlMs())
  }

  private clearRefreshCookie(res: Response) {
    clearRefreshCookie(res)
  }

  /* ------------------------------------------------------------ вход */

  @Public()
  @Post('register')
  @HttpCode(200)
  // Регистрация — дорогая операция (argon2) и мишень для спама.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const { challengeId, email } = await this.auth.register(dto, this.meta(req))
    return { challengeId, email, next: 'verify' }
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const { challengeId, email } = await this.auth.login(dto, this.meta(req))
    return { challengeId, email, next: 'verify' }
  }

  @Public()
  @Post('verify')
  @HttpCode(200)
  // Код всего из 4 цифр: без жёсткого лимита его перебрали бы за минуты.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verify(
    @Body() dto: VerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.auth.verify(
      dto.challengeId,
      dto.code,
      this.meta(req),
    )
    this.setRefreshCookie(res, refreshToken)
    return { accessToken, user }
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined
    if (!token) throw new UnauthorizedException('Сессия не найдена')

    const { accessToken, refreshToken, user } = await this.auth.refresh(token, this.meta(req))
    this.setRefreshCookie(res, refreshToken)
    return { accessToken, user }
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined)
    this.clearRefreshCookie(res)
    return { ok: true }
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const webOrigin = this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173'
    await this.auth.requestPasswordReset(dto.email, webOrigin)
    // Ответ одинаковый независимо от того, есть такой email или нет: иначе
    // форма превращается в способ проверять, кто зарегистрирован.
    return { ok: true, message: 'Если такой email зарегистрирован, письмо отправлено' }
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.newPassword)
    return { ok: true }
  }

  @Post('change-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async changePassword(@CurrentUser() payload: AccessPayload, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(payload.sub, payload.sid, dto.currentPassword, dto.newPassword)
    return { ok: true }
  }

  /* ------------------------------------------------------- профиль */

  @Get('me')
  async me(@CurrentUser() payload: AccessPayload) {
    return this.auth.getUserById(payload.sub)
  }

  @Post('change-credentials')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async changeCredentials(
    @CurrentUser() payload: AccessPayload,
    @Body() dto: ChangeCredentialsDto,
  ) {
    const user = await this.auth.changeCredentials(payload.sub, payload.sid, dto)
    return { user }
  }

  @Post('complete-profile')
  @Roles('OWNER')
  @HttpCode(200)
  async completeProfile(@CurrentUser() payload: AccessPayload, @Body() dto: CompleteProfileDto) {
    const user = await this.auth.completeProfile(payload.sub, dto)
    return { user }
  }

  @Get('sessions')
  async sessions(@CurrentUser() payload: AccessPayload) {
    return this.auth.listSessions(payload.sub, payload.sid)
  }

  @Delete('sessions/:id')
  @HttpCode(200)
  async revokeSession(@CurrentUser() payload: AccessPayload, @Param('id') id: string) {
    await this.auth.revokeSession(payload.sub, id)
    return { ok: true }
  }

  @Delete('sessions')
  @HttpCode(200)
  async revokeOthers(@CurrentUser() payload: AccessPayload) {
    return this.auth.revokeOtherSessions(payload.sub, payload.sid)
  }
}
