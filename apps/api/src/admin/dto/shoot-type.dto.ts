import { Type } from 'class-transformer'
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator'

export class CreateShootTypeDto {
  @IsString()
  @Length(2, 60, { message: 'Название вида съёмки — от 2 до 60 символов' })
  @Type(() => String)
  label!: string

  @IsOptional()
  @IsString()
  @MaxLength(400, { message: 'Описание — не длиннее 400 символов' })
  description?: string

  @Type(() => Number)
  @IsInt()
  @Min(0, { message: 'Цена не может быть отрицательной' })
  price!: number

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number
}

export class UpdateShootTypeDto {
  @IsOptional()
  @IsString()
  @Length(2, 60, { message: 'Название вида съёмки — от 2 до 60 символов' })
  label?: string

  @IsOptional()
  @IsString()
  @MaxLength(400, { message: 'Описание — не длиннее 400 символов' })
  description?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0, { message: 'Цена не может быть отрицательной' })
  price?: number

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number
}

export class ReorderShootTypesDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  ids!: string[]
}
