import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC = 'isPublic'

/** Открывает маршрут для неавторизованных: по умолчанию всё закрыто. */
export const Public = () => SetMetadata(IS_PUBLIC, true)
