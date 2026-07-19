import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { imageSize } from 'image-size'
import { PrismaService } from '../prisma/prisma.service'
import { publicUrl, storageDir } from '../common/storage'

/** Разрешённые типы и их расширения. Остальное отклоняем. */
const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

/**
 * Нужные поля загруженного файла. Свой интерфейс, чтобы не тянуть глобальный тип
 * из @types/multer (tsconfig ограничен types: ["node"]). Multer отдаёт эти поля.
 */
export interface UploadedImage {
  buffer: Buffer
  mimetype: string
  size: number
}

@Injectable()
export class ImagesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Сохранить загруженный файл на диск и завести запись Image. */
  async upload(file: UploadedImage) {
    const ext = MIME_EXT[file.mimetype]
    if (!ext) throw new BadRequestException('Поддерживаются только JPG, PNG и WebP')

    // Размеры читаем из содержимого — им доверяем, а не заголовку клиента.
    let dim: { width?: number; height?: number }
    try {
      dim = imageSize(file.buffer)
    } catch {
      throw new BadRequestException('Не удалось прочитать изображение')
    }
    if (!dim.width || !dim.height) throw new BadRequestException('Некорректное изображение')

    // Имя не завязано на исходное: избегаем коллизий и небезопасных символов.
    const name = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}${ext}`
    await writeFile(join(storageDir(), name), file.buffer)

    const image = await this.prisma.image.create({
      data: {
        path: name,
        width: dim.width,
        height: dim.height,
        mime: file.mimetype,
        size: file.size,
      },
      select: { id: true, path: true, width: true, height: true },
    })
    return { id: image.id, url: publicUrl(image.path), width: image.width, height: image.height }
  }

  /** Список загруженных изображений — для выбора в редакторах админки. */
  async list() {
    const images = await this.prisma.image.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, path: true, width: true, height: true, createdAt: true },
    })
    return images.map((i) => ({
      id: i.id,
      url: publicUrl(i.path),
      width: i.width,
      height: i.height,
      createdAt: i.createdAt,
    }))
  }

  /** Удалить изображение и файл. Ссылки на него (обложки/развороты) обнулятся. */
  async remove(id: string) {
    const image = await this.prisma.image.findUnique({ where: { id }, select: { id: true, path: true } })
    if (!image) throw new NotFoundException('Изображение не найдено')
    await this.prisma.image.delete({ where: { id } })
    // Файла может уже не быть — это не ошибка.
    await unlink(join(storageDir(), image.path)).catch(() => {})
    return { ok: true }
  }
}
