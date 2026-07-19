import { Type } from 'class-transformer'
import { IsInt, Min } from 'class-validator'

/** Взнос по ссылке доплаты. Верхнюю границу (остаток) проверяет сервис. */
export class PayDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number
}
