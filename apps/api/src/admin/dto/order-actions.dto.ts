import { Type } from 'class-transformer'
import { IsInt, Min } from 'class-validator'

/** Отмена заказа: сколько вернуть заказчику. Верхнюю границу проверяет сервис. */
export class CancelOrderDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  refundAmount!: number
}

/** Ручная отметка внесённой заказчиком суммы. */
export class SetPaidDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountPaid!: number
}
