import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { PrismaModule } from './prisma/prisma.module'
import { MailModule } from './mail/mail.module'
import { AuthModule } from './auth/auth.module'
import { OrdersModule } from './orders/orders.module'
import { AdminModule } from './admin/admin.module'
import { PaymentsModule } from './payments/payments.module'
import { ImagesModule } from './images/images.module'
import { HealthController } from './health/health.controller'
import { AboutController } from './about/about.controller'
import { CatalogController } from './catalog/catalog.controller'
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard'
import { RolesGuard } from './auth/guards/roles.guard'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Общий потолок запросов; на чувствительных ручках ужимаем через @Throttle.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    MailModule,
    AuthModule,
    OrdersModule,
    AdminModule,
    PaymentsModule,
    ImagesModule,
  ],
  controllers: [HealthController, AboutController, CatalogController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Закрыто по умолчанию: маршрут открывается явным @Public(). Так забытый
    // декоратор оборачивается отказом в доступе, а не дырой.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
