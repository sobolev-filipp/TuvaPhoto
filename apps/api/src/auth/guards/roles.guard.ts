import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { AuthedRequest } from './jwt-auth.guard'

export const ROLES_KEY = 'roles'

/** Ограничивает маршрут ролями: @Roles('OWNER'). */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required?.length) return true

    const req = context.switchToHttp().getRequest<AuthedRequest>()

    // Роль берём из токена. Она подписана сервером, поэтому подделать её
    // на клиенте нельзя.
    if (!req.user || !required.includes(req.user.role)) {
      throw new ForbiddenException('Недостаточно прав')
    }
    return true
  }
}
