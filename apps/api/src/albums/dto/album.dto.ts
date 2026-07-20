import { Type } from 'class-transformer'
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator'

/** Один разворот в редакторе альбома. */
export class SpreadInputDto {
  @IsOptional()
  @IsString()
  @Length(0, 80)
  label?: string

  @IsIn(['SINGLE', 'DOUBLE'])
  layout!: 'SINGLE' | 'DOUBLE'

  // Левое/основное фото и (для DOUBLE) правое. null — плейсхолдер без фото.
  @IsOptional()
  @IsString()
  imageId?: string | null

  @IsOptional()
  @IsString()
  rightImageId?: string | null
}

export class UpsertAlbumDto {
  @IsString()
  @Length(2, 120, { message: 'Название альбома — от 2 до 120 символов' })
  name!: string

  @IsOptional()
  @IsString()
  @Length(0, 160)
  subtitle?: string

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  desc?: string

  @IsString()
  categoryId!: string

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  shootTypeIds!: string[]

  @IsIn(['LANDSCAPE', 'PORTRAIT'])
  orientation!: 'LANDSCAPE' | 'PORTRAIT'

  @Type(() => Number)
  @IsInt()
  @Min(1)
  spreadsCount!: number

  @Type(() => Number)
  @IsInt()
  @Min(1)
  minSpreads!: number

  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxSpreads!: number

  @Type(() => Number)
  @IsInt()
  @Min(0)
  perSpread!: number

  @Type(() => Number)
  @IsInt()
  @Min(0)
  price!: number

  @IsOptional()
  @IsString()
  @Length(0, 120)
  format?: string

  @IsOptional()
  @IsString()
  coverImageId?: string | null

  @IsOptional()
  @IsString()
  backCoverImageId?: string | null

  @IsBoolean()
  isPublished!: boolean

  @IsBoolean()
  isFeatured!: boolean

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpreadInputDto)
  spreads!: SpreadInputDto[]
}
