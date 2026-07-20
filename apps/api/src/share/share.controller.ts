import { Controller, Get, Param } from '@nestjs/common'
import { ShareService } from './share.service'
import { Public } from '../auth/decorators/public.decorator'

/** Публичный просмотр демо-альбома по секретной ссылке /share/:token. */
@Public()
@Controller('share')
export class ShareController {
  constructor(private readonly share: ShareService) {}

  @Get(':token')
  get(@Param('token') token: string) {
    return this.share.getPublic(token)
  }
}
