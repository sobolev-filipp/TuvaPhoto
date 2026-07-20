import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { publicUrl } from '../common/storage'
import type { UpsertAlbumDto } from './dto/album.dto'

/** Ссылка на изображение в ответе (id + готовый url) или null. */
type ImgRef = { id: string; url: string } | null

/** Полный набор связей альбома для публичной витрины. */
const FULL_INCLUDE = {
  category: { select: { name: true, slug: true } },
  shootTypes: { select: { label: true }, orderBy: { sortOrder: 'asc' } },
  coverImage: { select: { path: true } },
  backCoverImage: { select: { path: true } },
  coverVariant: {
    select: {
      image: { select: { path: true } },
      backImage: { select: { path: true } },
    },
  },
  pages: {
    orderBy: { sortOrder: 'asc' },
    include: { image: { select: { path: true } }, rightImage: { select: { path: true } } },
  },
} satisfies Prisma.AlbumInclude

type FullAlbum = Prisma.AlbumGetPayload<{ include: typeof FULL_INCLUDE }>

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
        coverVariant: { select: { image: { select: { path: true } } } },
        _count: { select: { pages: true } },
      },
    })
    const cover = (a: { coverVariant: { image: { path: string } | null } | null; coverImage: { path: string } | null }) => {
      const img = a.coverVariant?.image ?? a.coverImage
      return img ? publicUrl(img.path) : null
    }
    return albums.map((a) => ({
      id: a.id,
      name: a.name,
      orientation: a.orientation,
      price: a.price,
      isPublished: a.isPublished,
      isFeatured: a.isFeatured,
      category: a.category.name,
      coverUrl: cover(a),
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
        coverVariant: {
          select: {
            image: { select: { id: true, path: true } },
            backImage: { select: { id: true, path: true } },
          },
        },
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
      spreadsCount: a.pages.length,
      minSpreads: a.minSpreads,
      maxSpreads: a.maxSpreads,
      perSpread: a.perSpread,
      price: a.price,
      format: a.format,
      isPublished: a.isPublished,
      isFeatured: a.isFeatured,
      inConstructor: a.inConstructor,
      sortOrder: a.sortOrder,
      coverVariantId: a.coverVariantId,
      // Превью обложки: из готовой обложки, иначе легаси-картинки альбома.
      cover: ref(a.coverVariant?.image ?? a.coverImage),
      backCover: ref(a.coverVariant?.backImage ?? a.backCoverImage),
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

  // --------------------------------------------------- Публичная витрина

  /** Опубликованные альбомы для каталога (фильтры: категория и/или «на главной»). */
  async publicList(opts: { categorySlug?: string; featuredOnly?: boolean } = {}) {
    const albums = await this.prisma.album.findMany({
      where: {
        isPublished: true,
        ...(opts.featuredOnly ? { isFeatured: true } : {}),
        ...(opts.categorySlug ? { category: { slug: opts.categorySlug } } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        subtitle: true,
        orientation: true,
        price: true,
        format: true,
        category: { select: { name: true, slug: true } },
        coverImage: { select: { path: true } },
        coverVariant: { select: { image: { select: { path: true } } } },
        shootTypes: { select: { label: true }, orderBy: { sortOrder: 'asc' } },
        _count: { select: { pages: true } },
      },
    })
    return albums.map((a) => {
      const img = a.coverVariant?.image ?? a.coverImage
      return {
        id: a.id,
        name: a.name,
        subtitle: a.subtitle,
        orientation: a.orientation,
        spreadsCount: a._count.pages,
        price: a.price,
        format: a.format,
        categoryName: a.category.name,
        categorySlug: a.category.slug,
        coverUrl: img ? publicUrl(img.path) : null,
        shootTypes: a.shootTypes.map((s) => s.label),
      }
    })
  }

  /** Опубликованные альбомы-«готовые варианты» для конструктора (с разворотами). */
  async constructorAlbums() {
    const albums = await this.prisma.album.findMany({
      where: { isPublished: true, inConstructor: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: FULL_INCLUDE,
    })
    return albums.map((a) => this.mapFull(a))
  }

  /** Опубликованные альбомы «на главную» — с разворотами (для листаемой книги). */
  async featured() {
    const albums = await this.prisma.album.findMany({
      where: { isPublished: true, isFeatured: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: FULL_INCLUDE,
    })
    return albums.map((a) => this.mapFull(a))
  }

  /** Полный опубликованный альбом для публичной страницы. */
  async publicOne(id: string) {
    const a = await this.prisma.album.findFirst({
      where: { id, isPublished: true },
      include: FULL_INCLUDE,
    })
    if (!a) throw new NotFoundException('Альбом не найден')
    return this.mapFull(a)
  }

  /** Единый маппинг полного альбома в публичный вид. */
  private mapFull(a: FullAlbum) {
    const url = (img: { path: string } | null | undefined) => (img ? publicUrl(img.path) : null)
    return {
      id: a.id,
      name: a.name,
      subtitle: a.subtitle,
      desc: a.desc,
      orientation: a.orientation,
      // Разворотов = число разворотов альбома.
      spreadsCount: a.pages.length,
      minSpreads: a.minSpreads,
      maxSpreads: a.maxSpreads,
      perSpread: a.perSpread,
      price: a.price,
      format: a.format,
      categoryName: a.category.name,
      categorySlug: a.category.slug,
      shootTypes: a.shootTypes.map((s) => s.label),
      // Обложка альбома — для применения готового варианта в конструкторе.
      coverVariantId: a.coverVariantId,
      // Готовая обложка приоритетна; легаси-картинки альбома — фоллбэк.
      coverUrl: url(a.coverVariant?.image ?? a.coverImage),
      backCoverUrl: url(a.coverVariant?.backImage ?? a.backCoverImage),
      spreads: a.pages.map((p) => ({
        label: p.label,
        layout: p.layout,
        imageUrl: url(p.image),
        rightImageUrl: url(p.rightImage),
      })),
    }
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
      // Количество разворотов = число добавленных разворотов (не вводится вручную).
      spreadsCount: dto.spreads.length,
      minSpreads: dto.minSpreads,
      maxSpreads: dto.maxSpreads,
      perSpread: dto.perSpread,
      price: dto.price,
      format: dto.format?.trim() ?? '',
      isPublished: dto.isPublished,
      isFeatured: dto.isFeatured,
      inConstructor: dto.inConstructor ?? false,
      sortOrder: dto.sortOrder ?? 0,
      coverVariantId: dto.coverVariantId ?? null,
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

    if (dto.coverVariantId) {
      const cover = await this.prisma.coverVariant.findUnique({
        where: { id: dto.coverVariantId },
        select: { id: true },
      })
      if (!cover) throw new BadRequestException('Обложка не найдена')
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
