import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { OrdersGateway } from '../realtime/orders.gateway'
import { slugify } from '../common/slug'
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto'

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

  // ------------------------------------------------------------- Категории

  /** Все обложки — для выбора в редакторе категории. */
  listCovers() {
    return this.prisma.coverVariant.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, priceMod: true },
    })
  }

  /** Категории с их разрешёнными обложками. */
  async listCategories() {
    const cats = await this.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        sortOrder: true,
        allowCover: true,
        coverVariants: { select: { id: true } },
      },
    })
    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      sortOrder: c.sortOrder,
      allowCover: c.allowCover,
      coverVariantIds: c.coverVariants.map((cv) => cv.id),
    }))
  }

  async createCategory(dto: CreateCategoryDto) {
    const slug = await this.uniqueSlug(dto.name)
    // Обложки привязываем только если разрешён их выбор.
    const coverIds = dto.allowCover ? await this.validCoverIds(dto.coverVariantIds) : []
    // Новая категория встаёт в конец списка (порядком управляют перетаскиванием).
    const last = await this.prisma.category.aggregate({ _max: { sortOrder: true } })
    const sortOrder = dto.sortOrder ?? (last._max.sortOrder ?? -1) + 1
    const created = await this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug,
        sortOrder,
        allowCover: dto.allowCover,
        coverVariants: { connect: coverIds.map((id) => ({ id })) },
      },
      select: { id: true },
    })
    return { id: created.id }
  }

  /** Порядок категорий = порядок id в списке. Управляется перетаскиванием в админке. */
  async reorderCategories(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, i) => this.prisma.category.update({ where: { id }, data: { sortOrder: i } })),
    )
    return { ok: true }
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({ where: { id }, select: { id: true } })
    if (!category) throw new NotFoundException('Категория не найдена')

    const allowCover = dto.allowCover
    // Если обложки заданы — переустанавливаем набор (пустой, если выбор запрещён).
    let coversUpdate: { set: { id: string }[] } | undefined
    if (dto.coverVariantIds || dto.allowCover === false) {
      const ids =
        allowCover === false ? [] : await this.validCoverIds(dto.coverVariantIds ?? [])
      coversUpdate = { set: ids.map((cid) => ({ id: cid })) }
    }

    await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.allowCover !== undefined ? { allowCover: dto.allowCover } : {}),
        ...(coversUpdate ? { coverVariants: coversUpdate } : {}),
      },
    })
    return { ok: true }
  }

  async deleteCategory(id: string) {
    const withAlbums = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true, _count: { select: { albums: true } } },
    })
    if (!withAlbums) throw new NotFoundException('Категория не найдена')
    if (withAlbums._count.albums > 0) {
      throw new BadRequestException('Нельзя удалить категорию, в которой есть альбомы')
    }
    // Заказы ссылаются на категорию через SetNull — они не мешают удалению.
    await this.prisma.category.delete({ where: { id } })
    return { ok: true }
  }

  /** Оставляет только реально существующие активные обложки из переданного списка. */
  private async validCoverIds(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return []
    const found = await this.prisma.coverVariant.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true },
    })
    return found.map((c) => c.id)
  }

  /** Уникальный slug из названия: при коллизии добавляем -2, -3, … */
  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || `cat-${randomBytes(3).toString('hex')}`
    let slug = base
    let n = 1
    while (await this.prisma.category.findUnique({ where: { slug }, select: { id: true } })) {
      n += 1
      slug = `${base}-${n}`
    }
    return slug
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
