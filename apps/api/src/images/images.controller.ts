import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ImagesService, type UploadedImage } from './images.service'
import { Roles } from '../auth/guards/roles.guard'

/** Загрузка и управление изображениями. Только владелец. */
@Roles('OWNER')
@Controller('admin/images')
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  @Post()
  // Память + лимит 15 МБ: файл держим в буфере, размеры читаем сами, потом пишем на диск.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  upload(@UploadedFile() file?: UploadedImage) {
    if (!file) throw new BadRequestException('Файл не получен')
    return this.images.upload(file)
  }

  @Get()
  list() {
    return this.images.list()
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.images.remove(id)
  }
}
