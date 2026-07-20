import { Controller, Get, Param, Query } from '@nestjs/common'
import { AlbumsService } from './albums.service'
import { Public } from '../auth/decorators/public.decorator'

/**
 * Публичная витрина альбомов: каталог, «на главную» и страница альбома.
 * Отдаём только опубликованные — черновики видны лишь в админке.
 */
@Public()
@Controller('albums')
export class PublicAlbumsController {
  constructor(private readonly albums: AlbumsService) {}

  // featured/constructor объявлены раньше :id, иначе попали бы в параметр id.
  @Get('featured')
  featured() {
    return this.albums.featured()
  }

  @Get('constructor')
  constructorAlbums() {
    return this.albums.constructorAlbums()
  }

  @Get()
  list(@Query('category') category?: string) {
    return this.albums.publicList({ categorySlug: category })
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.albums.publicOne(id)
  }
}
