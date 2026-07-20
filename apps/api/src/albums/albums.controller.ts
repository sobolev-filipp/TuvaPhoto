import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { AlbumsService } from './albums.service'
import { Roles } from '../auth/guards/roles.guard'
import { UpsertAlbumDto } from './dto/album.dto'

/** Управление альбомами. Только владелец. */
@Roles('OWNER')
@Controller('admin/albums')
export class AlbumsController {
  constructor(private readonly albums: AlbumsService) {}

  @Get()
  list() {
    return this.albums.list()
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.albums.getOne(id)
  }

  @Post()
  create(@Body() dto: UpsertAlbumDto) {
    return this.albums.create(dto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpsertAlbumDto) {
    return this.albums.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.albums.remove(id)
  }
}
