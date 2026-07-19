import { IsIn } from 'class-validator'

/** Смена статуса заказа из админки. */
export class UpdateOrderStatusDto {
  @IsIn(['PENDING', 'PAID', 'CANCELLED'])
  status!: 'PENDING' | 'PAID' | 'CANCELLED'
}
