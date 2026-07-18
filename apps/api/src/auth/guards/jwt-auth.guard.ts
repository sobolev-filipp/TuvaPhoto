import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { IS_PUBLIC } from '../decorators/public.decorator'
import type { AccessPayload } from '../auth.service'
import { PrismaService } from '../../prisma/prisma.service'

export interface AuthedRequest extends Request {
  user?: AccessPayload
}

/**
 * Проверка access-токена из заголовка Authorization.
 * Вешается глобально — маршрут открывается явным @Public(), а не наоборот:
 * забытый гвард тогда означает закрытую ручку, а не дыру.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const req = context.switchToHttp().getRequest<AuthedRequest>()
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Требуется авторизация')

    let payload: AccessPayload
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(header.slice(7), {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      })
    } catch {
      throw new UnauthorizedException('Токен недействителен или истёк')
    }

    // Access-токен подписан на 15 минут, но его сессия могла быть завершена
    // (выход, отзыв устройства, сброс/смена пароля). Без этой проверки токен
    // жил бы ещё до 15 минут после отзыва — проверяем, что сессия ещё жива.
    const session = await this.prisma.session.findUnique({ where: { id: payload.sid } })
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Сессия завершена')
    }

    req.user = payload
    return true
  }
}
