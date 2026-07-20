import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { publicUrl } from '../common/storage'
import type { UpsertAlbumDto } from './dto/album.dto'

/** Ссылка на изображение в ответе (id + готовый url) или null. */
type ImgRef = { id: string; url: string } | null

@Injectable()
export class AlbumsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Краткий список альбомов для вкладки «Альбомы». */
  async list() {
    const albums = await this.prisma.album.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        orientation: true,
        price: true,
        isPublished: true,
        isFeatured: true,
        category: { select: { name: true } },
        coverImage: { select: { path: true } },
        _count: { select: { pages: true } },
      },
    })
    return albums.map((a) => ({
      id: a.id,
      name: a.name,
      orientation: a.orientation,
      price: a.price,
      isPublished: a.isPublished,
      isFeatured: a.isFeatured,
      category: a.category.name,
      coverUrl: a.coverImage ? publicUrl(a.coverImage.path) : null,
      spreadsCount: a._count.pages,
    }))
  }

  /** Полный альбом для редактора. */
  async getOne(id: string) {
    const a = await this.prisma.album.findUnique({
      where: { id },
      include: {
        shootTypes: { select: { id: true } },
        coverImage: { select: { id: true, path: true } },
        backCoverImage: { select: { id: true, path: true } },
        pages: {
          orderBy: { sortOrder: 'asc' },
          include: {
            image: { select: { id: true, path: true } },
            rightImage: { select: { id: true, path: true } },
          },
        },
      },
    })
    if (!a) throw new NotFoundException('Альбом не найден')

    const ref = (img: { id: string; path: string } | null): ImgRef =>
      img ? { id: img.id, url: publicUrl(img.path) } : null

    return {
      id: a.id,
      name: a.name,
      subtitle: a.subtitle,
      desc: a.desc,
      categoryId: a.categoryId,
      shootTypeIds: a.shootTypes.map((s) => s.id),
      orientation: a.orientation,
      spreadsCount: a.spreadsCount,
      minSpreads: a.minSpreads,
      maxSpreads: a.maxSpreads,
      perSpread: a.perSpread,
      price: a.price,
      format: a.format,
      isPublished: a.isPublished,
      isFeatured: a.isFeatured,
      sortOrder: a.sortOrder,
      cover: ref(a.coverImage),
      backCover: ref(a.backCoverImage),
      spreads: a.pages.map((p) => ({
        label: p.label,
        layout: p.layout,
        image: ref(p.image),
        rightImage: ref(p.rightImage),
      })),
    }
  }

  async create(dto: UpsertAlbumDto) {
    await this.validateRefs(dto)
    const album = await this.prisma.album.create({
      data: this.buildData(dto, true),
      select: { id: true },
    })
    return { id: album.id }
  }

  async update(id: string, dto: UpsertAlbumDto) {
    const exists = await this.prisma.album.findUnique({ where: { id }, select: { id: true } })
    if (!exists) throw new NotFoundException('Альбом не найден')
    await this.validateRefs(dto)
    await this.prisma.album.update({ where: { id }, data: this.buildData(dto, false) })
    return { ok: true }
  }

  async remove(id: string) {
    const exists = await this.prisma.album.findUnique({ where: { id }, select: { id: true } })
    if (!exists) throw new NotFoundException('Альбом не найден')
    // Развороты удалятся каскадом (onDelete: Cascade).
    await this.prisma.album.delete({ where: { id } })
    return { ok: true }
  }

  /** Данные для create/update. isCreate влияет на форму связей spreads/shootTypes. */
  private buildData(dto: UpsertAlbumDto, isCreate: boolean) {
    const spreadsCreate = dto.spreads.map((s, i) => ({
      label: s.label ?? `Разворот ${i + 1}`,
      layout: s.layout,
      sortOrder: i,
      imageId: s.imageId ?? null,
      // Второе фото имеет смысл только для DOUBLE.
      rightImageId: s.layout === 'DOUBLE' ? (s.rightImageId ?? null) : null,
    }))

    return {
      name: dto.name.trim(),
      subtitle: dto.subtitle?.trim() ?? '',
      desc: dto.desc?.trim() ?? '',
      categoryId: dto.categoryId,
      orientation: dto.orientation,
      spreadsCount: dto.spreadsCount,
      minSpreads: dto.minSpreads,
      maxSpreads: dto.maxSpreads,
      perSpread: dto.perSpread,
      price: dto.price,
      format: dto.format?.trim() ?? '',
      isPublished: dto.isPublished,
      isFeatured: dto.isFeatured,
      sortOrder: dto.sortOrder ?? 0,
      coverImageId: dto.coverImageId ?? null,
      backCoverImageId: dto.backCoverImageId ?? null,
      shootTypes: isCreate
        ? { connect: dto.shootTypeIds.map((sid) => ({ id: sid })) }
        : { set: dto.shootTypeIds.map((sid) => ({ id: sid })) },
      // На обновлении полностью заменяем набор разворотов — редактор шлёт их целиком.
      pages: isCreate ? { create: spreadsCreate } : { deleteMany: {}, create: spreadsCreate },
    }
  }

  /** Проверяем, что категория, виды съёмки и картинки реально существуют. */
  private async validateRefs(dto: UpsertAlbumDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { id: true },
    })
    if (!category) throw new BadRequestException('Категория не найдена')

    if (dto.shootTypeIds.length) {
      const found = await this.prisma.shootType.count({ where: { id: { in: dto.shootTypeIds } } })
      if (found !== dto.shootTypeIds.length) throw new BadRequestException('Некоторые виды съёмки не найдены')
    }

    const imageIds = [
      dto.coverImageId,
      dto.backCoverImageId,
      ...dto.spreads.flatMap((s) => [s.imageId, s.rightImageId]),
    ].filter((v): v is string => typeof v === 'string' && v.length > 0)
    if (imageIds.length) {
      const unique = [...new Set(imageIds)]
      const found = await this.prisma.image.count({ where: { id: { in: unique } } })
      if (found !== unique.length) throw new BadRequestException('Некоторые изображения не найдены')
    }
  }
}
