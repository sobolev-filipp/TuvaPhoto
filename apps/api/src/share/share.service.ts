import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { PrismaService } from '../prisma/prisma.service'
import { publicUrl, storageDir } from '../common/storage'
import type { CreateShareDto } from './dto/create-share.dto'

/** Как часто фоновая чистка вычищает истёкшие демо (мс). */
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000

@Injectable()
export class ShareService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ShareService.name)
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Разовая чистка на старте + периодическая. Ошибки не роняют приложение.
    void this.cleanupExpired().catch((e) => this.logger.error('cleanup on init failed', e))
    this.timer = setInterval(() => {
      void this.cleanupExpired().catch((e) => this.logger.error('cleanup failed', e))
    }, CLEANUP_INTERVAL_MS)
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  // --------------------------------------------------------------- Админка

  /** Оплаченные заказы — для выбора при создании демо-ссылки (с поиском на клиенте). */
  async listPaidOrders() {
    const orders = await this.prisma.order.findMany({
      where: { status: 'PAID' },
      orderBy: { number: 'desc' },
      select: {
        id: true,
        number: true,
        fio: true,
        school: true,
        phone: true,
        total: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    })
    return orders.map((o) => ({
      id: o.id,
      number: o.number,
      fio: o.fio,
      school: o.school,
      phone: o.phone,
      email: o.user?.email ?? null,
      total: o.total,
      createdAt: o.createdAt,
    }))
  }

  /** Список демо-ссылок для админки. */
  async list() {
    const shares = await this.prisma.shareAlbum.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        token: true,
        title: true,
        subtitle: true,
        expiresAt: true,
        contentDeletedAt: true,
        diskUrl: true,
        downloadUntil: true,
        createdAt: true,
        order: { select: { number: true, fio: true } },
        coverImage: { select: { path: true } },
        _count: { select: { spreads: true } },
      },
    })
    const now = Date.now()
    return shares.map((s) => ({
      id: s.id,
      token: s.token,
      path: `/share/${s.token}`,
      title: s.title,
      subtitle: s.subtitle,
      orderNumber: s.order.number,
      orderFio: s.order.fio,
      expiresAt: s.expiresAt,
      expired: s.expiresAt.getTime() < now,
      contentDeleted: s.contentDeletedAt != null,
      diskUrl: s.diskUrl,
      downloadUntil: s.downloadUntil,
      spreadsCount: s._count.spreads,
      coverUrl: s.coverImage ? publicUrl(s.coverImage.path) : null,
      createdAt: s.createdAt,
    }))
  }

  async create(dto: CreateShareDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      select: { id: true, status: true },
    })
    if (!order) throw new NotFoundException('Заказ не найден')
    if (order.status !== 'PAID') {
      throw new BadRequestException('Демо-ссылку можно создать только для оплаченного заказа')
    }

    const expiresAt = new Date(dto.expiresAt)
    if (expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Срок истечения демо должен быть в будущем')
    }
    const downloadUntil = dto.downloadUntil ? new Date(dto.downloadUntil) : null

    await this.validateImages(dto)

    const token = randomBytes(24).toString('base64url')
    const share = await this.prisma.shareAlbum.create({
      data: {
        token,
        orderId: dto.orderId,
        title: dto.title.trim(),
        subtitle: dto.subtitle?.trim() ?? '',
        orientation: dto.orientation,
        coverImageId: dto.coverImageId ?? null,
        backCoverImageId: dto.backCoverImageId ?? null,
        expiresAt,
        diskUrl: dto.diskUrl?.trim() || null,
        downloadUntil,
        spreads: {
          create: dto.spreads.map((s, i) => ({
            label: s.label ?? '',
            layout: s.layout,
            sortOrder: i,
            imageId: s.imageId ?? null,
            rightImageId: s.layout === 'DOUBLE' ? (s.rightImageId ?? null) : null,
          })),
        },
      },
      select: { id: true, token: true },
    })
    return { id: share.id, token: share.token, path: `/share/${share.token}` }
  }

  async remove(id: string) {
    const share = await this.prisma.shareAlbum.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!share) throw new NotFoundException('Демо-альбом не найден')
    // Сначала освобождаем файлы снимка, затем удаляем строку (каскад разворотов).
    await this.deleteSnapshotImages(id)
    await this.prisma.shareAlbum.delete({ where: { id } })
    return { ok: true }
  }

  // -------------------------------------------------------------- Публично

  /** Демо по секретной ссылке. После истечения контент недоступен (и вычищается). */
  async getPublic(token: string) {
    const share = await this.prisma.shareAlbum.findUnique({
      where: { token },
      include: {
        coverImage: { select: { path: true } },
        backCoverImage: { select: { path: true } },
        spreads: {
          orderBy: { sortOrder: 'asc' },
          include: {
            image: { select: { path: true } },
            rightImage: { select: { path: true } },
          },
        },
      },
    })
    if (!share) throw new NotFoundException('Демо-альбом не найден')

    const expired = share.expiresAt.getTime() < Date.now()
    if (expired) {
      // Ленивая чистка: истёкшую ссылку открыли — освобождаем место сразу.
      if (!share.contentDeletedAt) {
        await this.cleanupOne(share.id).catch((e) => this.logger.error('lazy cleanup failed', e))
      }
      return {
        expired: true as const,
        title: share.title,
        subtitle: share.subtitle,
      }
    }

    const url = (img: { path: string } | null) => (img ? publicUrl(img.path) : null)
    return {
      expired: false as const,
      title: share.title,
      subtitle: share.subtitle,
      orientation: share.orientation,
      coverUrl: url(share.coverImage),
      backCoverUrl: url(share.backCoverImage),
      expiresAt: share.expiresAt,
      spreads: share.spreads.map((s) => ({
        label: s.label,
        layout: s.layout,
        imageUrl: url(s.image),
        rightImageUrl: url(s.rightImage),
      })),
    }
  }

  // --------------------------------------------------------- Автоочистка

  /** Вычистить тяжёлый контент всех истёкших демо (строки со ссылками остаются). */
  private async cleanupExpired() {
    const expired = await this.prisma.shareAlbum.findMany({
      where: { expiresAt: { lt: new Date() }, contentDeletedAt: null },
      select: { id: true },
    })
    for (const s of expired) {
      await this.cleanupOne(s.id)
    }
    if (expired.length) this.logger.log(`Вычищено истёкших демо: ${expired.length}`)
  }

  /** Удалить снимок одного демо: развороты, обложки-файлы; строку/ссылку сохраняем. */
  private async cleanupOne(id: string) {
    await this.deleteSnapshotImages(id)
    await this.prisma.shareSpread.deleteMany({ where: { shareAlbumId: id } })
    await this.prisma.shareAlbum.update({
      where: { id },
      data: { coverImageId: null, backCoverImageId: null, contentDeletedAt: new Date() },
    })
  }

  /**
   * Удаляет из БД и с диска картинки снимка демо, но только те, что больше нигде
   * не используются (у изображения нет других связей). Сначала снимаем ссылки на
   * них у самого демо, потом удаляем осиротевшие записи.
   */
  private async deleteSnapshotImages(shareAlbumId: string) {
    const share = await this.prisma.shareAlbum.findUnique({
      where: { id: shareAlbumId },
      select: {
        coverImageId: true,
        backCoverImageId: true,
        spreads: { select: { imageId: true, rightImageId: true } },
      },
    })
    if (!share) return

    const ids = new Set<string>()
    if (share.coverImageId) ids.add(share.coverImageId)
    if (share.backCoverImageId) ids.add(share.backCoverImageId)
    for (const sp of share.spreads) {
      if (sp.imageId) ids.add(sp.imageId)
      if (sp.rightImageId) ids.add(sp.rightImageId)
    }
    if (ids.size === 0) return

    // Снимаем ссылки этого демо на картинки, чтобы счётчики ниже их не учитывали.
    await this.prisma.shareSpread.deleteMany({ where: { shareAlbumId } })
    await this.prisma.shareAlbum.update({
      where: { id: shareAlbumId },
      data: { coverImageId: null, backCoverImageId: null },
    })

    for (const imageId of ids) {
      const img = await this.prisma.image.findUnique({
        where: { id: imageId },
        select: {
          path: true,
          _count: {
            select: {
              albumCovers: true,
              albumBackCovers: true,
              spreads: true,
              spreadsRight: true,
              coverVariants: true,
              coverVariantBacks: true,
              shareCovers: true,
              shareBackCovers: true,
              shareSpreads: true,
              shareSpreadRights: true,
              abouts: true,
              heroSlides: true,
            },
          },
        },
      })
      if (!img) continue
      const used = Object.values(img._count).reduce((a, n) => a + n, 0)
      if (used > 0) continue // картинка ещё где-то используется — не трогаем
      await this.prisma.image.delete({ where: { id: imageId } })
      await unlink(join(storageDir(), img.path)).catch(() => {})
    }
  }

  /** Проверяем, что все переданные картинки существуют. */
  private async validateImages(dto: CreateShareDto) {
    const ids = [
      dto.coverImageId,
      dto.backCoverImageId,
      ...dto.spreads.flatMap((s) => [s.imageId, s.rightImageId]),
    ].filter((v): v is string => typeof v === 'string' && v.length > 0)
    if (!ids.length) return
    const unique = [...new Set(ids)]
    const found = await this.prisma.image.count({ where: { id: { in: unique } } })
    if (found !== unique.length) throw new BadRequestException('Некоторые изображения не найдены')
  }
}
