import { Module } from '@nestjs/common'
import { AlbumsService } from './albums.service'
import { AlbumsController } from './albums.controller'
import { PublicAlbumsController } from './public-albums.controller'

@Module({
  providers: [AlbumsService],
  controllers: [AlbumsController, PublicAlbumsController],
})
export class AlbumsModule {}
