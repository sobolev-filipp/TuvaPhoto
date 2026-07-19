import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { OrdersGateway } from '../realtime/orders.gateway'

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: OrdersGateway,
  ) {}

  /** Данные заказа для страницы доплаты. Публично, но только по секретному токену. */
  async getByToken(token: string) {
    const order = await this.prisma.order.findUnique({
      where: { payToken: token },
      select: {
        number: true,
        fio: true,
        school: true,
        phone: true,
        total: true,
        amountPaid: true,
        payMethod: true,
        status: true,
        category: { select: { name: true } },
        coverVariant: { select: { label: true } },
        shootTypes: { select: { label: true } },
      },
    })
    if (!order) throw new NotFoundException('Ссылка недействительна')
    return {
      number: order.number,
      fio: order.fio,
      school: order.school,
      phone: order.phone,
      total: order.total,
      amountPaid: order.amountPaid,
      remaining: Math.max(0, order.total - order.amountPaid),
      payMethod: order.payMethod,
      status: order.status,
      category: order.category?.name ?? null,
      cover: order.coverVariant?.label ?? null,
      shootTypes: order.shootTypes.map((s) => s.label),
    }
  }

  /**
   * Внести оплату по ссылке (пока мок — реального провайдера нет). Сумму задаёт
   * заказчик; сервер лишь пополняет внесённое и, добрав до итога, ставит «Оплачен».
   */
  async payByToken(token: string, amount: number) {
    const order = await this.prisma.order.findUnique({
      where: { payToken: token },
      select: { id: true, number: true, total: true, amountPaid: true, status: true },
    })
    if (!order) throw new NotFoundException('Ссылка недействительна')
    if (order.status !== 'PENDING') {
      throw new BadRequestException('Заказ уже не ожидает оплаты')
    }
    const remaining = order.total - order.amountPaid
    if (!Number.isInteger(amount) || amount < 1 || amount > remaining) {
      throw new BadRequestException(`Сумма должна быть от 1 до ${remaining} ₽`)
    }
    const nextPaid = order.amountPaid + amount
    const paidInFull = nextPaid >= order.total
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        amountPaid: nextPaid,
        status: paidInFull ? 'PAID' : 'PENDING',
        paidAt: paidInFull ? new Date() : null,
      },
    })
    this.gateway.emitOrderUpdated({ number: order.number })
    return { amountPaid: nextPaid, remaining: Math.max(0, order.total - nextPaid), paidInFull }
  }
}
