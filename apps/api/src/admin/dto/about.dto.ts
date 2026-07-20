import { Transform } from 'class-transformer'
import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator'

/**
 * Обновление блока «О фотографе» (синглтон About). Все поля необязательны —
 * приходит то, что изменилось. Телефон храним как ввели (публичный GET /about
 * сам приводит к красивому виду и tel:-ссылке).
 */
export class UpdateAboutDto {
  @IsOptional()
  @IsString()
  @Length(2, 120, { message: 'ФИО — от 2 до 120 символов' })
  fio?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  role?: string

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  desc?: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string

  @IsOptional()
  @IsEmail({}, { message: 'Укажите корректный email' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tg?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  vk?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  max?: string

  // Фото фотографа: id загруженного изображения или null (убрать фото).
  @IsOptional()
  @IsString()
  photoImageId?: string | null
}
