import { Controller, Get } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { Public } from '../auth/decorators/public.decorator'

/**
 * Справочники для конструктора: виды съёмки и варианты обложек, которые владелец
 * завёл в админке. Публично — конструктор доступен без входа.
 */
@Public()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('options')
  async options() {
    const [shootTypes, coverVariants, categories] = await Promise.all([
      this.prisma.shootType.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, label: true, description: true, price: true },
      }),
      this.prisma.coverVariant.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, label: true, priceMod: true },
      }),
      this.prisma.category.findMany({
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          allowCover: true,
          // Только активные обложки этой категории.
          coverVariants: { where: { isActive: true }, select: { id: true } },
          // Только активные виды съёмки этой категории.
          shootTypes: { where: { isActive: true }, select: { id: true } },
        },
      }),
    ])

    return {
      shootTypes,
      // Обложки — единым справочником; какие показать, решает выбранная категория.
      coverVariants: coverVariants.map((c) => ({
        id: c.id,
        label: c.label,
        priceMod: c.priceMod,
        // Пока фото обложек не отдаём (нет загрузки) — плейсхолдер на фронте.
        imageUrl: null as string | null,
      })),
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        allowCover: c.allowCover,
        coverVariantIds: c.coverVariants.map((cv) => cv.id),
        shootTypeIds: c.shootTypes.map((s) => s.id),
      })),
    }
  }
}
