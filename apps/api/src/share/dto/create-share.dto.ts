import { Type } from 'class-transformer'
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  ValidateNested,
} from 'class-validator'

export class ShareSpreadInputDto {
  @IsOptional()
  @IsString()
  @Length(0, 80)
  label?: string

  @IsIn(['SINGLE', 'DOUBLE'])
  layout!: 'SINGLE' | 'DOUBLE'

  @IsOptional()
  @IsString()
  imageId?: string | null

  @IsOptional()
  @IsString()
  rightImageId?: string | null
}

export class CreateShareDto {
  @IsString()
  orderId!: string

  @IsString()
  @Length(2, 120, { message: 'Заголовок — от 2 до 120 символов' })
  title!: string

  @IsOptional()
  @IsString()
  @Length(0, 160)
  subtitle?: string

  @IsIn(['LANDSCAPE', 'PORTRAIT'])
  orientation!: 'LANDSCAPE' | 'PORTRAIT'

  @IsOptional()
  @IsString()
  coverImageId?: string | null

  @IsOptional()
  @IsString()
  backCoverImageId?: string | null

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShareSpreadInputDto)
  spreads!: ShareSpreadInputDto[]

  // Срок жизни демо-просмотра (ISO-дата в будущем).
  @IsDateString({}, { message: 'Укажите дату истечения демо' })
  expiresAt!: string

  // Ссылка на облако с фото (необязательно).
  @IsOptional()
  @IsUrl({}, { message: 'Ссылка на диск должна быть корректным URL' })
  diskUrl?: string | null

  // Срок, до которого можно скачать фото с диска (необязательно).
  @IsOptional()
  @IsDateString()
  downloadUntil?: string | null
}
