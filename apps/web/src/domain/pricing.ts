import type { CoverVariant, PayType, ShootType } from './types'

/** Цена за разворот по умолчанию, если альбом/пресет её не задаёт. */
export const DEFAULT_PER_SPREAD = 420

export interface PriceInput {
  shoots: ShootType[]
  spreads: number
  perSpread: number
  cover: CoverVariant | null
}

export interface PriceBreakdown {
  shoots: number
  spreads: number
  cover: number
  total: number
}

/**
 * Формула из прототипа:
 *   сумма цен выбранных съёмок + развороты × perSpread + модификатор обложки
 *
 * Важно: бэкенд обязан пересчитать заказ этой же формулой и не доверять
 * сумме, пришедшей с клиента.
 */
export function calcPrice({ shoots, spreads, perSpread, cover }: PriceInput): PriceBreakdown {
  const shootsSum = shoots.reduce((acc, s) => acc + s.price, 0)
  const spreadsSum = spreads * perSpread
  const coverSum = cover?.priceMod ?? 0
  return {
    shoots: shootsSum,
    spreads: spreadsSum,
    cover: coverSum,
    total: shootsSum + spreadsSum + coverSum,
  }
}

/** Сумма к оплате: предоплата 50% округляется вверх до рубля. */
export function amountDue(total: number, payType: PayType): number {
  return payType === 'prepay50' ? Math.ceil(total / 2) : total
}

const rub = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

export function formatPrice(value: number): string {
  return rub.format(value)
}

/** Склонение: 1 разворот / 2 разворота / 5 разворотов */
export function pluralSpreads(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} разворот`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} разворота`
  return `${n} разворотов`
}
