import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { Request } from 'express'
import { OrdersService } from './orders.service'
import { CreateOrderDto } from './dto/create-order.dto'
import { Public } from '../auth/decorators/public.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import type { AccessPayload } from '../auth/auth.service'

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Оформление заказа. Публично: заказать альбом можно и без регистрации.
   * Но если пользователь вошёл — привяжем заказ к нему (токен читаем мягко,
   * без требования авторизации).
   */
  @Public()
  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async create(@Body() dto: CreateOrderDto, @Req() req: Request) {
    const userId = await this.softUserId(req)
    return this.orders.create(dto, userId, {
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    })
  }

  /** История заказов текущего пользователя (для личного кабинета). Требует входа. */
  @Get('mine')
  mine(@CurrentUser() user: AccessPayload) {
    return this.orders.listMine(user.sub)
  }

  /** Мягко достаём userId из Bearer, если он есть и валиден; иначе null. */
  private async softUserId(req: Request): Promise<string | null> {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) return null
    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(header.slice(7), {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      })
      return payload.sub
    } catch {
      return null
    }
  }
}
