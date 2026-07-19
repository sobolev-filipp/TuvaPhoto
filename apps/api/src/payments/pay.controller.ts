import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { PaymentsService } from './payments.service'
import { Public } from '../auth/decorators/public.decorator'
import { PayDto } from './dto/pay.dto'

/**
 * Публичная страница доплаты /pay/:token. Доступ — по секретному токену из
 * ссылки, которую владелец отправляет заказчику. Авторизация не нужна.
 */
@Public()
@Controller('pay')
export class PayController {
  constructor(private readonly payments: PaymentsService) {}

  @Get(':token')
  get(@Param('token') token: string) {
    return this.payments.getByToken(token)
  }

  @Post(':token')
  @HttpCode(200)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  pay(@Param('token') token: string, @Body() dto: PayDto) {
    return this.payments.payByToken(token, dto.amount)
  }
}
