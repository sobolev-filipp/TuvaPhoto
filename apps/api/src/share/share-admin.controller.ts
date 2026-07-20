import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { ShareService } from './share.service'
import { Roles } from '../auth/guards/roles.guard'
import { CreateShareDto } from './dto/create-share.dto'

/** Управление демо-ссылками (готовые альбомы для клиента). Только владелец. */
@Roles('OWNER')
@Controller('admin/share')
export class ShareAdminController {
  constructor(private readonly share: ShareService) {}

  /** Оплаченные заказы для выбора при создании демо. */
  @Get('orders')
  paidOrders() {
    return this.share.listPaidOrders()
  }

  @Get()
  list() {
    return this.share.list()
  }

  @Post()
  create(@Body() dto: CreateShareDto) {
    return this.share.create(dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.share.remove(id)
  }
}
