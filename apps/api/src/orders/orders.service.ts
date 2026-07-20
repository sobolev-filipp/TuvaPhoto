import { BadRequestException, Injectable } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { calcPrice, DEFAULT_PER_SPREAD, resolvePrepay } from '../common/pricing'
import { OrdersGateway } from '../realtime/orders.gateway'
import type { CreateOrderDto } from './dto/create-order.dto'

/** Версия условий/оферты на момент согласия. Меняется при правке документа. */
const ORDER_TERMS_VERSION = '2026-07-19'

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: OrdersGateway,
  ) {}

  /**
   * Создание заказа из конструктора. Цену считаем ЗДЕСЬ по данным из БД:
   * клиент присылает только выбор (какие съёмки, обложка, развороты), а суммы
   * берём из справочников — иначе цену можно было бы подделать на клиенте.
   */
  async create(
    dto: CreateOrderDto,
    userId: string | null,
    meta: { ip: string | null; userAgent: string | null } = { ip: null, userAgent: null },
  ) {
    // Берём только реально существующие активные съёмки; их цены — из БД.
    const shootTypes = await this.prisma.shootType.findMany({
      where: { id: { in: dto.shootTypeIds }, isActive: true },
      select: { id: true, price: true },
    })
    if (shootTypes.length === 0) {
      throw new BadRequestException('Выбранные виды съёмки недоступны')
    }

    // Категория (если передана) определяет, можно ли выбирать обложку и какую.
    let categoryId: string | null = null
    let allowedCoverIds: Set<string> | null = null
    let categoryAllowsCover = true
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
        select: { id: true, allowCover: true, coverVariants: { select: { id: true } } },
      })
      if (!category) throw new BadRequestException('Категория не найдена')
      categoryId = category.id
      categoryAllowsCover = category.allowCover
      allowedCoverIds = new Set(category.coverVariants.map((c) => c.id))
    }

    let coverMod = 0
    let coverVariantId: string | null = null
    if (dto.coverVariantId) {
      // Обложка допустима только если категория её разрешает (когда категория задана).
      if (dto.categoryId && (!categoryAllowsCover || !allowedCoverIds?.has(dto.coverVariantId))) {
        throw new BadRequestException('Эта обложка недоступна для выбранной категории')
      }
      const cover = await this.prisma.coverVariant.findFirst({
        where: { id: dto.coverVariantId, isActive: true },
        select: { id: true, priceMod: true },
      })
      if (!cover) throw new BadRequestException('Выбранная обложка недоступна')
      coverMod = cover.priceMod
      coverVariantId = cover.id
    }

    const perSpread = DEFAULT_PER_SPREAD
    const parts = calcPrice({
      shootPrices: shootTypes.map((s) => s.price),
      spreads: dto.spreads,
      perSpread,
      coverMod,
    })
    // Предоплату считаем и валидируем на сервере по фактическому итогу.
    let due: number
    let prepayPercent: number | null
    try {
      const resolved = resolvePrepay(parts.total, {
        payType: dto.payType,
        prepayPercent: dto.prepayPercent,
        prepayAmount: dto.prepayAmount,
      })
      due = resolved.amountDue
      prepayPercent = resolved.prepayPercent
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Неверная предоплата')
    }

    // Оплата замокана (реального провайдера нет): считаем, что заказчик внёс
    // выбранную сумму прямо при оформлении. Полная оплата → сразу «Оплачен».
    // Когда подключим настоящий эквайринг — сюда встанет подтверждение платежа.
    const amountPaid = due
    const paidInFull = amountPaid >= parts.total

    const order = await this.prisma.order.create({
      data: {
        userId,
        categoryId,
        // Ссылку на доплату генерируем сразу: заказчик видит её в истории и может
        // доплатить остаток, а владелец — переслать ту же ссылку.
        payToken: randomBytes(24).toString('base64url'),
        fio: dto.fio,
        school: dto.school,
        phone: dto.phone,
        coverVariantId,
        shootTypes: { connect: shootTypes.map((s) => ({ id: s.id })) },
        spreadsCount: dto.spreads,
        perSpread,
        priceShoots: parts.priceShoots,
        priceSpreads: parts.priceSpreads,
        priceCover: parts.priceCover,
        total: parts.total,
        amountDue: due,
        amountPaid,
        payType: dto.payType,
        prepayPercent,
        payMethod: dto.payMethod,
        status: paidInFull ? 'PAID' : 'PENDING',
        paidAt: paidInFull ? new Date() : null,
      },
      select: { number: true, total: true, amountDue: true },
    })

    // Фиксируем согласие (152-ФЗ): версия документа, IP, дата — доказательство
    // акцепта оферты и согласия на обработку ПДн на момент заказа.
    await this.prisma.consent.create({
      data: {
        userId,
        kind: 'PERSONAL_DATA',
        policyVersion: ORDER_TERMS_VERSION,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    })

    // Пуш в комнату admin: бейдж новых заказов обновляется без перезагрузки.
    this.gateway.emitOrderCreated({ number: order.number })

    return order
  }

  /** История заказов конкретного пользователя для личного кабинета. */
  async listMine(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        number: true,
        status: true,
        total: true,
        amountPaid: true,
        amountDue: true,
        payType: true,
        prepayPercent: true,
        payToken: true,
        createdAt: true,
        category: { select: { name: true } },
        coverVariant: { select: { label: true } },
        shootTypes: { select: { label: true } },
        // Демо-альбомы (share-ссылки), сделанные владельцем по заказу.
        shareAlbums: {
          orderBy: { createdAt: 'desc' },
          select: {
            token: true,
            title: true,
            expiresAt: true,
            diskUrl: true,
            downloadUntil: true,
          },
        },
      },
    })
    const now = Date.now()
    return orders.map((o) => ({
      number: o.number,
      status: o.status,
      total: o.total,
      amountPaid: o.amountPaid,
      remaining: Math.max(0, o.total - o.amountPaid),
      amountDue: o.amountDue,
      payType: o.payType,
      prepayPercent: o.prepayPercent,
      // Доплатить можно только пока заказ ждёт оплату.
      payToken: o.status === 'PENDING' ? o.payToken : null,
      createdAt: o.createdAt,
      category: o.category?.name ?? null,
      cover: o.coverVariant?.label ?? null,
      shootTypes: o.shootTypes.map((s) => s.label),
      // Готовые демо-альбомы: ссылка на просмотр (пока не истекла) и на диск.
      shares: o.shareAlbums.map((s) => ({
        title: s.title,
        path: `/share/${s.token}`,
        expiresAt: s.expiresAt,
        expired: s.expiresAt.getTime() < now,
        diskUrl: s.diskUrl,
        downloadUntil: s.downloadUntil,
      })),
    }))
  }
}
