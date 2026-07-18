import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { Public } from '../auth/decorators/public.decorator'

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Проверка живости. Реально ходит в базу: эндпоинт, который отвечает «ок»
   * не приходя в БД, не отличит рабочий сервис от сломанного.
   */
  @Public()
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      throw new ServiceUnavailableException({ status: 'error', db: 'down' })
    }
    return { status: 'ok', db: 'up', time: new Date().toISOString() }
  }
}
