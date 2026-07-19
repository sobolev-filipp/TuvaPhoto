import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { OrdersGateway } from './orders.gateway'

/**
 * Realtime-канал для админки. Вынесен отдельным модулем и экспортирует гейтвей,
 * чтобы OrdersModule мог эмитить `order.created`, не таща за собой сокет-логику.
 */
@Module({
  imports: [JwtModule.register({})],
  providers: [OrdersGateway],
  exports: [OrdersGateway],
})
export class RealtimeModule {}
