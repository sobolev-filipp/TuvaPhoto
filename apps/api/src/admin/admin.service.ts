import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { OrdersGateway } from '../realtime/orders.gateway'

/** Заказ в том виде, в каком его показывает админка. */
const orderSelect = {
  id: true,
  number: true,
  fio: true,
  school: true,
  phone: true,
  spreadsCount: true,
  perSpread: true,
  priceShoots: true,
  priceSpreads: true,
  priceCover: true,
  total: true,
  amountDue: true,
  amountPaid: true,
  refundAmount: true,
  payToken: true,
  payType: true,
  prepayPercent: true,
  payMethod: true,
  status: true,
  readAt: true,
  createdAt: true,
  category: { select: { name: true } },
  coverVariant: { select: { label: true } },
  shootTypes: { select: { label: true } },
} as const

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: OrdersGateway,
  ) {}

  /** Все заказы, новые сверху. Для небольшого потока пагинация не нужна. */
  listOrders() {
    return this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      select: orderSelect,
    })
  }

  /** Число непрочитанных — источник правды для бейджа (переживает перезагрузку). */
  async unreadCount(): Promise<number> {
    return this.prisma.order.count({ where: { readAt: null } })
  }

  /** Пометить один заказ прочитанным. Повторный вызов не меняет readAt. */
  async markRead(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, select: { id: true, readAt: true } })
    if (!order) throw new NotFoundException('Заказ не найден')
    if (!order.readAt) {
      await this.prisma.order.update({ where: { id }, data: { readAt: new Date() } })
    }
    return { ok: true }
  }

  /** Пометить прочитанными все новые заказы разом. */
  async markAllRead() {
    const { count } = await this.prisma.order.updateMany({
      where: { readAt: null },
      data: { readAt: new Date() },
    })
    return { read: count }
  }

  /**
   * Указать вручную, сколько заказчик внёс. Доступно только пока ждём оплату.
   * Когда набрана полная сумма — заказ автоматически становится «Оплачен».
   */
  async setPaid(id: string, amountPaid: number) {
    const order = await this.requireOrder(id)
    if (order.status !== 'PENDING') {
      throw new BadRequestException('Внесённую сумму можно менять только у заказа в ожидании оплаты')
    }
    if (amountPaid < 0 || amountPaid > order.total) {
      throw new BadRequestException(`Сумма должна быть от 0 до ${order.total} ₽`)
    }
    const paidInFull = amountPaid >= order.total
    await this.prisma.order.update({
      where: { id },
      data: {
        amountPaid,
        status: paidInFull ? 'PAID' : 'PENDING',
        paidAt: paidInFull ? new Date() : null,
      },
    })
    this.gateway.emitOrderUpdated({ number: order.number })
    return { ok: true }
  }

  /**
   * Сгенерировать (или вернуть существующую) ссылку на доплату. Токен постоянный
   * для заказа — повторная генерация отдаёт тот же, чтобы старая ссылка не протухла.
   */
  async createPayLink(id: string) {
    const order = await this.requireOrder(id)
    if (order.status !== 'PENDING') {
      throw new BadRequestException('Ссылка на доплату нужна только у заказа в ожидании оплаты')
    }
    let token = order.payToken
    if (!token) {
      token = randomBytes(24).toString('base64url')
      await this.prisma.order.update({ where: { id }, data: { payToken: token } })
    }
    return { token, path: `/pay/${token}` }
  }

  /**
   * Отмена заказа владельцем. Единственный «ручной» переход. Переводит в
   * «ожидание возврата» и фиксирует сумму к возврату (по умолчанию — внесённое).
   */
  async cancel(id: string, refundAmount: number) {
    const order = await this.requireOrder(id)
    if (order.status !== 'PENDING' && order.status !== 'PAID') {
      throw new BadRequestException('Отменить можно только активный заказ')
    }
    if (refundAmount < 0 || refundAmount > order.total) {
      throw new BadRequestException(`Сумма возврата должна быть от 0 до ${order.total} ₽`)
    }
    await this.prisma.order.update({
      where: { id },
      data: { status: 'REFUND_PENDING', refundAmount },
    })
    this.gateway.emitOrderUpdated({ number: order.number })
    return { ok: true }
  }

  /** Подтвердить, что деньги возвращены заказчику. Только из «ожидания возврата». */
  async markRefunded(id: string) {
    const order = await this.requireOrder(id)
    if (order.status !== 'REFUND_PENDING') {
      throw new BadRequestException('Заказ не в статусе ожидания возврата')
    }
    await this.prisma.order.update({ where: { id }, data: { status: 'REFUNDED' } })
    this.gateway.emitOrderUpdated({ number: order.number })
    return { ok: true }
  }

  private async requireOrder(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { id: true, number: true, status: true, total: true, payToken: true },
    })
    if (!order) throw new NotFoundException('Заказ не найден')
    return order
  }
}
