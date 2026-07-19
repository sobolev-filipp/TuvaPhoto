import { Module } from '@nestjs/common'
import { PaymentsService } from './payments.service'
import { PayController } from './pay.controller'
import { RealtimeModule } from '../realtime/realtime.module'

@Module({
  imports: [RealtimeModule],
  providers: [PaymentsService],
  controllers: [PayController],
})
export class PaymentsModule {}
