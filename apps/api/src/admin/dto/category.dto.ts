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

export class CreateCategoryDto {
  @IsString()
  @Length(2, 60, { message: 'Название категории — от 2 до 60 символов' })
  @Type(() => String)
  name!: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number

  // Можно ли выбирать обложку в этой категории.
  @IsBoolean()
  allowCover!: boolean

  // Разрешённые обложки. Учитываются только при allowCover=true.
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  coverVariantIds!: string[]

  // Виды съёмки, доступные в этой категории.
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  shootTypeIds!: string[]
}

export class ReorderCategoriesDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  ids!: string[]
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @Length(2, 60, { message: 'Название категории — от 2 до 60 символов' })
  name?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number

  @IsOptional()
  @IsBoolean()
  allowCover?: boolean

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  coverVariantIds?: string[]

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  shootTypeIds?: string[]
}
