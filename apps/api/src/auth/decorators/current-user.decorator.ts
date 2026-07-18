import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { AccessPayload } from '../auth.service'
import type { AuthedRequest } from '../guards/jwt-auth.guard'

/** Достаёт payload access-токена, положенный JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessPayload => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>()
    // Гвард отработал раньше, иначе до обработчика бы не дошло.
    return req.user!
  },
)
