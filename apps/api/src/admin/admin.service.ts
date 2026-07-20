import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { OrdersGateway } from '../realtime/orders.gateway'
import { slugify } from '../common/slug'
import { publicUrl } from '../common/storage'
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto'
import type { CreateShootTypeDto, UpdateShootTypeDto } from './dto/shoot-type.dto'
import type { CreateCoverDto, UpdateCoverDto } from './dto/cover.dto'
import type { UpdateAboutDto } from './dto/about.dto'

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

  /**
   * Все обложки, включая выключенные — для управления и для выбора в редакторах
   * (там активные фильтруются на клиенте). С готовыми url передней/задней картинки
   * и списком категорий, к которым обложка привязана.
   */
  async listCovers() {
    const covers = await this.prisma.coverVariant.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        label: true,
        priceMod: true,
        isActive: true,
        sortOrder: true,
        imageId: true,
        backImageId: true,
        image: { select: { path: true } },
        backImage: { select: { path: true } },
        categories: { select: { id: true } },
      },
    })
    return covers.map((c) => ({
      id: c.id,
      label: c.label,
      priceMod: c.priceMod,
      isActive: c.isActive,
      sortOrder: c.sortOrder,
      imageId: c.imageId,
      backImageId: c.backImageId,
      imageUrl: c.image ? publicUrl(c.image.path) : null,
      backImageUrl: c.backImage ? publicUrl(c.backImage.path) : null,
      categoryIds: c.categories.map((x) => x.id),
    }))
  }

  async createCover(dto: CreateCoverDto) {
    await this.requireImage(dto.imageId)
    if (dto.backImageId) await this.requireImage(dto.backImageId)
    const catIds = await this.validCategoryIds(dto.categoryIds ?? [])
    const last = await this.prisma.coverVariant.aggregate({ _max: { sortOrder: true } })
    const sortOrder = dto.sortOrder ?? (last._max.sortOrder ?? -1) + 1
    const created = await this.prisma.coverVariant.create({
      data: {
        label: dto.label.trim(),
        priceMod: dto.priceMod,
        imageId: dto.imageId,
        backImageId: dto.backImageId ?? null,
        isActive: dto.isActive ?? true,
        sortOrder,
        categories: { connect: catIds.map((id) => ({ id })) },
      },
      select: { id: true },
    })
    return { id: created.id }
  }

  /** Порядок обложек = порядок id в списке. */
  async reorderCovers(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, i) => this.prisma.coverVariant.update({ where: { id }, data: { sortOrder: i } })),
    )
    return { ok: true }
  }

  async updateCover(id: string, dto: UpdateCoverDto) {
    const cover = await this.prisma.coverVariant.findUnique({ where: { id }, select: { id: true } })
    if (!cover) throw new NotFoundException('Обложка не найдена')
    if (dto.imageId) await this.requireImage(dto.imageId)
    if (dto.backImageId) await this.requireImage(dto.backImageId)

    let catUpdate: { set: { id: string }[] } | undefined
    if (dto.categoryIds) {
      const ids = await this.validCategoryIds(dto.categoryIds)
      catUpdate = { set: ids.map((cid) => ({ id: cid })) }
    }

    await this.prisma.coverVariant.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
        ...(dto.priceMod !== undefined ? { priceMod: dto.priceMod } : {}),
        ...(dto.imageId !== undefined ? { imageId: dto.imageId } : {}),
        // null очищает заднюю обложку.
        ...(dto.backImageId !== undefined ? { backImageId: dto.backImageId ?? null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(catUpdate ? { categories: catUpdate } : {}),
      },
    })
    return { ok: true }
  }

  /**
   * Удаление обложки. Если она в заказах или альбомах — не удаляем (потеряем
   * историю/сломаем альбом), предлагаем выключить. Связи с категориями снимаются
   * каскадом (M2M).
   */
  async deleteCover(id: string) {
    const cover = await this.prisma.coverVariant.findUnique({
      where: { id },
      select: { id: true, _count: { select: { orders: true, albums: true } } },
    })
    if (!cover) throw new NotFoundException('Обложка не найдена')
    if (cover._count.orders > 0) {
      throw new BadRequestException('Обложка есть в заказах — её можно выключить, но не удалить')
    }
    if (cover._count.albums > 0) {
      throw new BadRequestException('Обложка используется в альбомах — сначала уберите её из альбомов')
    }
    await this.prisma.coverVariant.delete({ where: { id } })
    return { ok: true }
  }

  // --------------------------------------------------------- О фотографе

  /** Данные «О фотографе» для редактора (с id фото и готовым url). */
  async getAbout() {
    const about = await this.prisma.about.findUnique({
      where: { id: 'about' },
      include: { photoImage: { select: { path: true } } },
    })
    if (!about) {
      return {
        fio: '',
        role: '',
        desc: '',
        phone: '',
        email: '',
        address: '',
        tg: '',
        vk: '',
        max: '',
        photoImageId: null as string | null,
        photoUrl: null as string | null,
      }
    }
    return {
      fio: about.fio,
      role: about.role,
      desc: about.desc,
      phone: about.phone,
      email: about.email,
      address: about.address,
      tg: about.tg,
      vk: about.vk,
      max: about.max,
      photoImageId: about.photoImageId,
      photoUrl: about.photoImage ? publicUrl(about.photoImage.path) : null,
    }
  }

  /** Обновить блок «О фотографе». Синглтон — создаём при первом сохранении. */
  async updateAbout(dto: UpdateAboutDto) {
    if (dto.photoImageId) await this.requireImage(dto.photoImageId)
    const data = {
      ...(dto.fio !== undefined ? { fio: dto.fio.trim() } : {}),
      ...(dto.role !== undefined ? { role: dto.role.trim() } : {}),
      ...(dto.desc !== undefined ? { desc: dto.desc.trim() } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.address !== undefined ? { address: dto.address.trim() } : {}),
      ...(dto.tg !== undefined ? { tg: dto.tg.trim() } : {}),
      ...(dto.vk !== undefined ? { vk: dto.vk.trim() } : {}),
      ...(dto.max !== undefined ? { max: dto.max.trim() } : {}),
      // null очищает фото.
      ...(dto.photoImageId !== undefined ? { photoImageId: dto.photoImageId ?? null } : {}),
    }
    await this.prisma.about.upsert({
      where: { id: 'about' },
      create: {
        id: 'about',
        fio: dto.fio?.trim() ?? '',
        role: dto.role?.trim() ?? '',
        desc: dto.desc?.trim() ?? '',
        phone: dto.phone?.trim() ?? '',
        email: dto.email ?? '',
        address: dto.address?.trim() ?? '',
        tg: dto.tg?.trim() ?? '',
        vk: dto.vk?.trim() ?? '',
        max: dto.max?.trim() ?? '',
        photoImageId: dto.photoImageId ?? null,
      },
      update: data,
    })
    return { ok: true }
  }

  private async requireImage(id: string) {
    const img = await this.prisma.image.findUnique({ where: { id }, select: { id: true } })
    if (!img) throw new BadRequestException('Изображение не найдено')
  }

  /** Оставляет только реально существующие категории из переданного списка. */
  private async validCategoryIds(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return []
    const found = await this.prisma.category.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    })
    return found.map((c) => c.id)
  }

  /**
   * Все виды съёмки, включая выключенные — для управления в админке и для выбора
   * в редакторе категории (там активные фильтруются на клиенте). Порядок = порядок
   * вывода в конструкторе.
   */
  listShootTypes() {
    return this.prisma.shootType.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        label: true,
        description: true,
        price: true,
        isActive: true,
        sortOrder: true,
      },
    })
  }

  async createShootType(dto: CreateShootTypeDto) {
    // Новый вид встаёт в конец (порядком управляет перетаскивание).
    const last = await this.prisma.shootType.aggregate({ _max: { sortOrder: true } })
    const sortOrder = dto.sortOrder ?? (last._max.sortOrder ?? -1) + 1
    const created = await this.prisma.shootType.create({
      data: {
        label: dto.label.trim(),
        description: dto.description?.trim() ?? '',
        price: dto.price,
        isActive: dto.isActive ?? true,
        sortOrder,
      },
      select: { id: true },
    })
    return { id: created.id }
  }

  /** Порядок видов съёмки = порядок id в списке. */
  async reorderShootTypes(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, i) => this.prisma.shootType.update({ where: { id }, data: { sortOrder: i } })),
    )
    return { ok: true }
  }

  async updateShootType(id: string, dto: UpdateShootTypeDto) {
    const st = await this.prisma.shootType.findUnique({ where: { id }, select: { id: true } })
    if (!st) throw new NotFoundException('Вид съёмки не найден')
    await this.prisma.shootType.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    })
    return { ok: true }
  }

  /**
   * Удаление вида съёмки. Если он уже фигурирует в заказах или альбомах — не
   * удаляем (иначе потеряем историю/сломаем альбом), предлагаем выключить.
   * Связи с категориями (M2M) снимаются автоматически каскадом.
   */
  async deleteShootType(id: string) {
    const st = await this.prisma.shootType.findUnique({
      where: { id },
      select: { id: true, _count: { select: { orders: true, albums: true } } },
    })
    if (!st) throw new NotFoundException('Вид съёмки не найден')
    if (st._count.orders > 0) {
      throw new BadRequestException('Вид съёмки есть в заказах — его можно выключить, но не удалить')
    }
    if (st._count.albums > 0) {
      throw new BadRequestException('Вид съёмки используется в альбомах — сначала уберите его из альбомов')
    }
    await this.prisma.shootType.delete({ where: { id } })
    return { ok: true }
  }

  /** Категории с их разрешёнными обложками и видами съёмки. */
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
        shootTypes: { select: { id: true } },
      },
    })
    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      sortOrder: c.sortOrder,
      allowCover: c.allowCover,
      coverVariantIds: c.coverVariants.map((cv) => cv.id),
      shootTypeIds: c.shootTypes.map((s) => s.id),
    }))
  }

  async createCategory(dto: CreateCategoryDto) {
    const slug = await this.uniqueSlug(dto.name)
    // Обложки привязываем только если разрешён их выбор.
    const coverIds = dto.allowCover ? await this.validCoverIds(dto.coverVariantIds) : []
    // Новая категория встаёт в конец списка (порядком управляют перетаскиванием).
    const last = await this.prisma.category.aggregate({ _max: { sortOrder: true } })
    const sortOrder = dto.sortOrder ?? (last._max.sortOrder ?? -1) + 1
    const shootIds = await this.validShootTypeIds(dto.shootTypeIds)
    const created = await this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug,
        sortOrder,
        allowCover: dto.allowCover,
        coverVariants: { connect: coverIds.map((id) => ({ id })) },
        shootTypes: { connect: shootIds.map((id) => ({ id })) },
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

    let shootsUpdate: { set: { id: string }[] } | undefined
    if (dto.shootTypeIds) {
      const ids = await this.validShootTypeIds(dto.shootTypeIds)
      shootsUpdate = { set: ids.map((sid) => ({ id: sid })) }
    }

    await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.allowCover !== undefined ? { allowCover: dto.allowCover } : {}),
        ...(coversUpdate ? { coverVariants: coversUpdate } : {}),
        ...(shootsUpdate ? { shootTypes: shootsUpdate } : {}),
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

  /** Оставляет только реально существующие активные виды съёмки. */
  private async validShootTypeIds(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return []
    const found = await this.prisma.shootType.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true },
    })
    return found.map((s) => s.id)
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
