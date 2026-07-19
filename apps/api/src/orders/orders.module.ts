import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { OrdersService } from './orders.service'
import { OrdersController } from './orders.controller'
import { RealtimeModule } from '../realtime/realtime.module'

@Module({
  imports: [JwtModule.register({}), RealtimeModule],
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}
