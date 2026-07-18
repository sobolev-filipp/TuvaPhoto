import 'reflect-metadata'
import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  app.setGlobalPrefix('api')
  app.use(cookieParser())

  // Клиент за прокси (Caddy/nginx): без этого req.ip покажет адрес прокси,
  // и в сессиях у всех будет один и тот же IP.
  app.set('trust proxy', 1)

  app.useGlobalPipes(
    new ValidationPipe({
      // Всё, что не описано в DTO, отбрасываем: клиент не должен иметь
      // возможности дослать лишнее поле (например, role или сумму заказа).
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  })

  const port = Number(process.env.PORT ?? 3000)
  await app.listen(port)
  new Logger('Bootstrap').log(`API слушает http://localhost:${port}/api`)
}

void bootstrap()
