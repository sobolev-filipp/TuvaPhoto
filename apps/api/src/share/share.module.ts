import { Module } from '@nestjs/common'
import { ShareService } from './share.service'
import { ShareController } from './share.controller'
import { ShareAdminController } from './share-admin.controller'

/** Демо-альбомы для клиента по секретной ссылке /share/:token. */
@Module({
  controllers: [ShareController, ShareAdminController],
  providers: [ShareService],
})
export class ShareModule {}
