import { Type } from 'class-transformer'
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator'

export class CreateCoverDto {
  @IsString()
  @Length(2, 60, { message: 'Название обложки — от 2 до 60 символов' })
  @Type(() => String)
  label!: string

  @Type(() => Number)
  @IsInt()
  @Min(0, { message: 'Надбавка не может быть отрицательной' })
  priceMod!: number

  // Передняя обложка — обязательна.
  @IsString({ message: 'Нужно выбрать фото передней обложки' })
  imageId!: string

  // Задняя обложка — необязательна (null очищает).
  @IsOptional()
  @IsString()
  backImageId?: string | null

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number

  // Категории, к которым привязана обложка.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  categoryIds?: string[]
}

export class UpdateCoverDto {
  @IsOptional()
  @IsString()
  @Length(2, 60, { message: 'Название обложки — от 2 до 60 символов' })
  label?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0, { message: 'Надбавка не может быть отрицательной' })
  priceMod?: number

  @IsOptional()
  @IsString()
  imageId?: string

  @IsOptional()
  @IsString()
  backImageId?: string | null

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  categoryIds?: string[]
}

export class ReorderCoversDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  ids!: string[]
}
