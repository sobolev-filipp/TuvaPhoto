import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

/**
 * Клиент Prisma как сервис Nest.
 * С Prisma 7 подключение идёт через драйвер-адаптер (node-postgres),
 * строка подключения приходит из конфига, а не из schema.prisma.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('DATABASE_URL')
    super({ adapter: new PrismaPg({ connectionString: url }) })
  }

  async onModuleInit() {
    // Подключаемся на старте: падать лучше сразу, а не на первом запросе клиента.
    await this.$connect()
    this.logger.log('Подключение к базе установлено')
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
