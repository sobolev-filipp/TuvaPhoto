import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import type { Server, Socket } from 'socket.io'
import type { AccessPayload } from '../auth/auth.service'
import { PrismaService } from '../prisma/prisma.service'

/** Комната, куда попадают только владельцы: в неё летят события о заказах. */
const ADMIN_ROOM = 'admin'

/**
 * Realtime для админки. Один канал — событие `order.created`, чтобы бейдж новых
 * заказов обновлялся без перезагрузки.
 *
 * Авторизация не на гвардах, а вручную при подключении: у сокета нет
 * заголовка Authorization, токен клиент кладёт в `handshake.auth.token`.
 * Пускаем в комнату `admin` только OWNER с ЖИВОЙ сессией в БД — та же
 * проверка, что и у JwtAuthGuard, иначе отозванный токен слушал бы события.
 */
@WebSocketGateway({
  // Клиент в деве ходит через vite-прокси (origin 5173) на api (3000).
  cors: { origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173', credentials: true },
})
export class OrdersGateway implements OnGatewayConnection {
  private readonly logger = new Logger(OrdersGateway.name)

  @WebSocketServer()
  server!: Server

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const payload = await this.authorize(client)
    if (!payload) {
      // Неавторизованный или не владелец — молча отключаем, событий он не увидит.
      client.disconnect(true)
      return
    }
    await client.join(ADMIN_ROOM)
  }

  /** Разбор и проверка токена из рукопожатия. Возвращает payload или null. */
  private async authorize(client: Socket): Promise<AccessPayload | null> {
    const raw = client.handshake.auth?.token
    const token = typeof raw === 'string' ? raw : null
    if (!token) return null

    let payload: AccessPayload
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      })
    } catch {
      return null
    }

    if (payload.role !== 'OWNER') return null

    // Токен мог остаться жить после выхода/отзыва — проверяем сессию в БД.
    const session = await this.prisma.session.findUnique({ where: { id: payload.sid } })
    if (!session || session.expiresAt < new Date()) return null

    return payload
  }

  /**
   * Сообщить админам, что появился новый заказ. Полезную нагрузку держим
   * минимальной: клиент по событию перезапросит список и счётчик из БД —
   * так бейдж остаётся согласованным с базой, а не только с сокетом.
   */
  emitOrderCreated(order: { number: number }): void {
    this.server.to(ADMIN_ROOM).emit('order.created', { number: order.number })
  }

  /** Заказ изменился (оплата/отмена/возврат) — админке пора перезапросить список. */
  emitOrderUpdated(order: { number: number }): void {
    this.server.to(ADMIN_ROOM).emit('order.updated', { number: order.number })
  }
}
