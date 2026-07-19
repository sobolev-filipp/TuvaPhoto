import { Controller, Get } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { Public } from '../auth/decorators/public.decorator'
import { formatPhone, normalizePhone } from '../common/phone'

/**
 * Данные «О фотографе» для публичной части (футер, контакты, кнопки звонка).
 * Владелец задаёт их при онбординге и позже в админке.
 */
@Public()
@Controller('about')
export class AboutController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get() {
    const about = await this.prisma.about.findUnique({ where: { id: 'about' } })
    if (!about) {
      return {
        fio: '',
        role: '',
        desc: '',
        email: '',
        address: '',
        phone: '',
        phoneHref: null,
        tg: '',
        vk: '',
        photoUrl: null,
      }
    }

    // Телефон храним как ввели; наружу отдаём и красивый вид, и ссылку tel:.
    const normalized = normalizePhone(about.phone)

    return {
      fio: about.fio,
      role: about.role,
      desc: about.desc,
      email: about.email,
      address: about.address,
      phone: normalized ? formatPhone(normalized) : about.phone,
      phoneHref: normalized ? `tel:${normalized}` : null,
      // Значки соцсетей на сайте показываются только для заполненных ссылок.
      tg: about.tg,
      vk: about.vk,
      photoUrl: null,
    }
  }
}
