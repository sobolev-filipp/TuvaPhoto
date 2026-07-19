import type { CoverVariant, ShootType } from './types'

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

/** Пресеты процентов предоплаты. Держать синхронно с бэком (common/pricing.ts). */
export const PREPAY_PERCENTS = [20, 30, 40, 50] as const

/** Минимальная предоплата — 20% от суммы, вверх до рубля. */
export function minPrepay(total: number): number {
  return Math.ceil(total * 0.2)
}

/** Выбор предоплаты в конструкторе. */
export type PrepayChoice =
  | { kind: 'percent'; percent: number }
  | { kind: 'full' }
  | { kind: 'custom'; amount: number }

/**
 * Сколько платить сейчас — превью для клиента. Истину всё равно считает сервер,
 * но UI должен показывать ту же сумму. Своя сумма зажимается в [20%..итог].
 */
export function prepayDue(total: number, choice: PrepayChoice): number {
  if (choice.kind === 'full') return total
  if (choice.kind === 'percent') return Math.ceil((total * choice.percent) / 100)
  return Math.min(total, Math.max(minPrepay(total), Math.round(choice.amount) || 0))
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
