import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { calcPrice, DEFAULT_PER_SPREAD, resolvePrepay } from '../common/pricing'
import { OrdersGateway } from '../realtime/orders.gateway'
import type { CreateOrderDto } from './dto/create-order.dto'

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
  async create(dto: CreateOrderDto, userId: string | null) {
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

    const order = await this.prisma.order.create({
      data: {
        userId,
        categoryId,
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
        payType: dto.payType,
        prepayPercent,
        payMethod: dto.payMethod,
        // Оплата пока замокана: заказ создаётся со статусом «ожидает оплаты».
        status: 'PENDING',
      },
      select: { number: true, total: true, amountDue: true },
    })

    // Пуш в комнату admin: бейдж новых заказов обновляется без перезагрузки.
    this.gateway.emitOrderCreated({ number: order.number })

    return order
  }
}
