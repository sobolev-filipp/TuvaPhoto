import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator'
import { normalizePhone } from '../../common/phone'
import { MAX_SPREADS, MIN_SPREADS } from '../../common/pricing'

export class CreateOrderDto {
  @IsString()
  @Length(2, 120, { message: 'Укажите ФИО' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fio!: string

  @IsString()
  @Length(2, 200, { message: 'Укажите школу или адрес' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  school!: string

  @Matches(/^\+79\d{9}$/, { message: 'Укажите телефон в формате +7 (9xx) xxx-xx-xx' })
  @Transform(({ value }) => (typeof value === 'string' ? (normalizePhone(value) ?? value) : value))
  phone!: string

  @IsOptional()
  @IsString()
  categoryId?: string | null

  @IsOptional()
  @IsString()
  coverVariantId?: string | null

  // Хотя бы одна съёмка. Дубли и лишнее сервер отфильтрует по факту наличия в БД.
  @IsArray()
  @ArrayNotEmpty({ message: 'Выберите хотя бы один вид съёмки' })
  @ArrayMaxSize(20)
  @IsString({ each: true })
  shootTypeIds!: string[]

  @Type(() => Number)
  @IsInt()
  @Min(MIN_SPREADS)
  @Max(MAX_SPREADS)
  spreads!: number

  @IsIn(['PREPAY', 'FULL'])
  payType!: 'PREPAY' | 'FULL'

  // Процент предоплаты (пресет). Взаимоисключим со своей суммой; проверку
  // диапазона и что задано хоть что-то делает сервис по фактическому итогу.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([20, 30, 40, 50])
  prepayPercent?: number

  // Своя сумма предоплаты в рублях. Нижнюю границу (20% от итога) проверяет сервис.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  prepayAmount?: number

  @IsOptional()
  @IsIn(['SBP', 'BANK'])
  payMethod?: 'SBP' | 'BANK'
}
