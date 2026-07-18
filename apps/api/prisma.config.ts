import 'dotenv/config'
import { defineConfig } from 'prisma/config'

/**
 * Конфиг Prisma CLI (migrate, generate, seed).
 * С Prisma 7 строка подключения задаётся здесь, а не в schema.prisma.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
})
