/**
 * Формула цены альбома. Должна совпадать с фронтовой (apps/web/src/domain/pricing.ts),
 * но истина — здесь: сервер пересчитывает заказ сам и не доверяет сумме с клиента.
 */

/** Цена за разворот по умолчанию (пока альбомы не заведены в админке). */
export const DEFAULT_PER_SPREAD = 420

export const MIN_SPREADS = 10
export const MAX_SPREADS = 40

export interface PriceParts {
  priceShoots: number
  priceSpreads: number
  priceCover: number
  total: number
}

export function calcPrice(input: {
  shootPrices: number[]
  spreads: number
  perSpread: number
  coverMod: number
}): PriceParts {
  const priceShoots = input.shootPrices.reduce((a, b) => a + b, 0)
  const priceSpreads = input.spreads * input.perSpread
  const priceCover = input.coverMod
  return {
    priceShoots,
    priceSpreads,
    priceCover,
    total: priceShoots + priceSpreads + priceCover,
  }
}

/** Допустимые проценты предоплаты (пресеты в конструкторе). */
export const PREPAY_PERCENTS = [20, 30, 40, 50] as const

/** Минимальная предоплата — 20% от суммы, округляем вверх до рубля. */
export function minPrepay(total: number): number {
  return Math.ceil(total * 0.2)
}

export interface PrepayChoice {
  payType: 'PREPAY' | 'FULL'
  /** Процент предоплаты для пресета (20/30/40/50). */
  prepayPercent?: number | null
  /** Своя сумма предоплаты в рублях (если процент не задан). */
  prepayAmount?: number | null
}

export interface PrepayResult {
  amountDue: number
  prepayPercent: number | null
}

/**
 * Сколько клиент платит сейчас. Истина на сервере: процент, своя сумма и полная
 * оплата валидируются здесь, клиентской сумме не доверяем.
 * Бросать ошибку тексто-совместимо с остальным API — вызывающий оборачивает.
 */
export function resolvePrepay(total: number, choice: PrepayChoice): PrepayResult {
  if (choice.payType === 'FULL') return { amountDue: total, prepayPercent: null }

  // PREPAY: либо процент из пресета, либо своя сумма (но не ниже 20% и не выше итога).
  if (choice.prepayPercent != null) {
    if (!PREPAY_PERCENTS.includes(choice.prepayPercent as (typeof PREPAY_PERCENTS)[number])) {
      throw new Error('Недопустимый процент предоплаты')
    }
    return { amountDue: Math.ceil((total * choice.prepayPercent) / 100), prepayPercent: choice.prepayPercent }
  }

  const amount = choice.prepayAmount
  if (amount == null || !Number.isInteger(amount)) {
    throw new Error('Укажите сумму предоплаты')
  }
  if (amount < minPrepay(total) || amount > total) {
    throw new Error(`Предоплата должна быть от ${minPrepay(total)} до ${total} ₽`)
  }
  return { amountDue: amount, prepayPercent: null }
}
