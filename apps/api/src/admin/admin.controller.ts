import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common'
import { AdminService } from './admin.service'
import { Roles } from '../auth/guards/roles.guard'
import { CancelOrderDto, SetPaidDto } from './dto/order-actions.dto'
import { CreateCategoryDto, ReorderCategoriesDto, UpdateCategoryDto } from './dto/category.dto'
import {
  CreateShootTypeDto,
  ReorderShootTypesDto,
  UpdateShootTypeDto,
} from './dto/shoot-type.dto'
import { CreateCoverDto, ReorderCoversDto, UpdateCoverDto } from './dto/cover.dto'
import { UpdateAboutDto } from './dto/about.dto'

/**
 * Админка владельца. Все ручки строго @Roles('OWNER') — глобальный JwtAuthGuard
 * уже требует авторизацию, RolesGuard дополнительно отсекает не-владельцев.
 */
@Roles('OWNER')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('orders')
  listOrders() {
    return this.admin.listOrders()
  }

  @Get('orders/unread-count')
  async unreadCount() {
    return { count: await this.admin.unreadCount() }
  }

  @Post('orders/read-all')
  @HttpCode(200)
  markAllRead() {
    return this.admin.markAllRead()
  }

  @Post('orders/:id/read')
  @HttpCode(200)
  markRead(@Param('id') id: string) {
    return this.admin.markRead(id)
  }

  /** Ручная отметка внесённой суммы (при полной — заказ станет «Оплачен»). */
  @Post('orders/:id/set-paid')
  @HttpCode(200)
  setPaid(@Param('id') id: string, @Body() dto: SetPaidDto) {
    return this.admin.setPaid(id, dto.amountPaid)
  }

  /** Сгенерировать/получить ссылку на доплату. */
  @Post('orders/:id/pay-link')
  @HttpCode(200)
  payLink(@Param('id') id: string) {
    return this.admin.createPayLink(id)
  }

  /** Отменить заказ → ожидание возврата (с суммой к возврату). */
  @Post('orders/:id/cancel')
  @HttpCode(200)
  cancel(@Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.admin.cancel(id, dto.refundAmount)
  }

  /** Подтвердить возврат средств → «Деньги возвращены». */
  @Post('orders/:id/refunded')
  @HttpCode(200)
  refunded(@Param('id') id: string) {
    return this.admin.markRefunded(id)
  }

  // ------------------------------------------------------------- Категории

  @Get('covers')
  listCovers() {
    return this.admin.listCovers()
  }

  @Post('covers')
  createCover(@Body() dto: CreateCoverDto) {
    return this.admin.createCover(dto)
  }

  @Post('covers/reorder')
  @HttpCode(200)
  reorderCovers(@Body() dto: ReorderCoversDto) {
    return this.admin.reorderCovers(dto.ids)
  }

  @Patch('covers/:id')
  updateCover(@Param('id') id: string, @Body() dto: UpdateCoverDto) {
    return this.admin.updateCover(id, dto)
  }

  @Delete('covers/:id')
  deleteCover(@Param('id') id: string) {
    return this.admin.deleteCover(id)
  }

  @Get('shoot-types')
  listShootTypes() {
    return this.admin.listShootTypes()
  }

  @Post('shoot-types')
  createShootType(@Body() dto: CreateShootTypeDto) {
    return this.admin.createShootType(dto)
  }

  @Post('shoot-types/reorder')
  @HttpCode(200)
  reorderShootTypes(@Body() dto: ReorderShootTypesDto) {
    return this.admin.reorderShootTypes(dto.ids)
  }

  @Patch('shoot-types/:id')
  updateShootType(@Param('id') id: string, @Body() dto: UpdateShootTypeDto) {
    return this.admin.updateShootType(id, dto)
  }

  @Delete('shoot-types/:id')
  deleteShootType(@Param('id') id: string) {
    return this.admin.deleteShootType(id)
  }

  @Get('categories')
  listCategories() {
    return this.admin.listCategories()
  }

  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.admin.createCategory(dto)
  }

  @Post('categories/reorder')
  @HttpCode(200)
  reorderCategories(@Body() dto: ReorderCategoriesDto) {
    return this.admin.reorderCategories(dto.ids)
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.admin.updateCategory(id, dto)
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.admin.deleteCategory(id)
  }

  // ----------------------------------------------------------- О фотографе

  @Get('about')
  getAbout() {
    return this.admin.getAbout()
  }

  @Patch('about')
  updateAbout(@Body() dto: UpdateAboutDto) {
    return this.admin.updateAbout(dto)
  }
}
