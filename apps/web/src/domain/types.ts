/**
 * Доменные типы витрины. Повторяют форму будущих ответов API,
 * чтобы переход с демо-данных на бэкенд не менял компоненты.
 */

export type Id = string

export interface Category {
  id: Id
  name: string
  slug: string
}

/** Вид фотосессии. Цена суммируется по всем выбранным в конструкторе. */
export interface ShootType {
  id: Id
  label: string
  desc: string
  price: number
}

/** Вариант обложки из админки. `priceMod` — надбавка к итогу. */
export interface CoverVariant {
  id: Id
  label: string
  priceMod: number
  imageUrl: string | null
}

/** Одна страница книги = один разворот = одно фото на всю ширину. */
export interface Spread {
  id: Id
  label: string
  imageUrl: string | null
}

export interface Album {
  id: Id
  name: string
  subtitle: string
  desc: string
  categoryId: Id
  shootTypeIds: Id[]
  /** Кол-во разворотов в готовом варианте; в конструкторе — дефолт слайдера. */
  spreads: number
  minSpreads: number
  maxSpreads: number
  /** Цена за один разворот, задаётся в админке. */
  perSpread: number
  price: number
  format: string
  coverUrl: string | null
  backCoverUrl: string | null
  pages: Spread[]
}

export interface Review {
  id: Id
  name: string
  role: string
  rating: number
  text: string
  createdAt: string
}

export interface About {
  fio: string
  role: string
  desc: string
  photoUrl: string | null
  phone: string
  email: string
  address: string
  tg: string
  vk: string
}

export type PayType = 'prepay50' | 'full'
export type PayMethod = 'sbp' | 'bank'
