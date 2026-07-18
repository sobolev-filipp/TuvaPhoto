/**
 * Демо-набор витрины. Реальных фото пока нет (imageUrl: null) — компоненты
 * рисуют плейсхолдер. Когда появится API, этот модуль заменяется запросами;
 * форма данных совпадает с типами в ./types.
 */
import type { About, Album, Category, CoverVariant, Review, ShootType } from './types'
import { DEFAULT_PER_SPREAD } from './pricing'

export const CONTACT_PHONE = '+7 923 388 27 07'
export const CONTACT_PHONE_HREF = 'tel:+79233882707'
export const CONTACT_EMAIL = 'Tuvafoto@mail.ru'

export const categories: Category[] = [
  { id: 'c1', name: 'Детский сад', slug: 'kindergarten' },
  { id: 'c2', name: 'Начальная школа', slug: 'primary' },
  { id: 'c3', name: 'Старшеклассники', slug: 'senior' },
]

export const shootTypes: ShootType[] = [
  { id: 's1', label: 'Классическая', desc: 'Портреты и общее фото класса в интерьере школы', price: 6500 },
  { id: 's2', label: 'Студийная', desc: 'Съёмка в студии со светом и реквизитом', price: 9500 },
  { id: 's3', label: 'Выездная', desc: 'Локация на природе или в городе', price: 11000 },
  { id: 's4', label: 'Репортаж', desc: 'Живые кадры с занятий, репетиций и праздника', price: 8000 },
]

export const coverVariants: CoverVariant[] = [
  { id: 'v1', label: 'Классика', priceMod: 0, imageUrl: null },
  { id: 'v2', label: 'Кожа', priceMod: 900, imageUrl: null },
  { id: 'v3', label: 'Лён', priceMod: 700, imageUrl: null },
  { id: 'v4', label: 'Дерево', priceMod: 1500, imageUrl: null },
  { id: 'v5', label: 'Бархат', priceMod: 1200, imageUrl: null },
  { id: 'v6', label: 'Тиснение золотом', priceMod: 2200, imageUrl: null },
]

const spreads = (base: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${base}-P${i}`,
    label: `Разворот ${String(i + 1).padStart(2, '0')}`,
    imageUrl: null,
  }))

export const albums: Album[] = [
  {
    id: 'a1',
    name: 'Выпускной 2026',
    subtitle: 'Премиальная фотокнига',
    desc: 'Классический выпускной альбом для 11 класса: портреты каждого ученика, общее фото, кадры с последнего звонка. Твёрдая обложка с тиснением, плотные развороты, ручная сборка.',
    categoryId: 'c3',
    shootTypeIds: ['s1', 's4'],
    spreads: 20,
    minSpreads: 12,
    maxSpreads: 40,
    perSpread: DEFAULT_PER_SPREAD,
    price: 18900,
    format: '21×30 см (альбомная)',
    coverUrl: null,
    backCoverUrl: null,
    pages: spreads('a1', 6),
  },
  {
    id: 'a2',
    name: 'Первый выпуск',
    subtitle: 'Альбом детского сада',
    desc: 'Тёплый альбом про выпуск из детского сада: портреты, игры, утренник. Мягкие цвета, крупные фото и место для подписи каждого ребёнка.',
    categoryId: 'c1',
    shootTypeIds: ['s1', 's2'],
    spreads: 14,
    minSpreads: 10,
    maxSpreads: 30,
    perSpread: 380,
    price: 12400,
    format: '21×21 см (квадратная)',
    coverUrl: null,
    backCoverUrl: null,
    pages: spreads('a2', 6),
  },
  {
    id: 'a3',
    name: 'Начальная школа',
    subtitle: 'Четыре года вместе',
    desc: 'Альбом об окончании начальной школы: как менялся класс за четыре года, портреты, репортаж с уроков и общая фотография.',
    categoryId: 'c2',
    shootTypeIds: ['s1', 's3'],
    spreads: 16,
    minSpreads: 10,
    maxSpreads: 34,
    perSpread: 400,
    price: 14700,
    format: '21×30 см (альбомная)',
    coverUrl: null,
    backCoverUrl: null,
    pages: spreads('a3', 6),
  },
  {
    id: 'a4',
    name: 'Студийный выпуск',
    subtitle: 'Свет и характер',
    desc: 'Студийная съёмка со светом и реквизитом: каждый портрет проработан отдельно, единый стиль всего альбома.',
    categoryId: 'c3',
    shootTypeIds: ['s2'],
    spreads: 18,
    minSpreads: 12,
    maxSpreads: 36,
    perSpread: 450,
    price: 21500,
    format: '25×30 см (альбомная)',
    coverUrl: null,
    backCoverUrl: null,
    pages: spreads('a4', 6),
  },
  {
    id: 'a5',
    name: 'На природе',
    subtitle: 'Выездная съёмка',
    desc: 'Выездная съёмка на локации: горы, степь, берег. Живые кадры класса вне стен школы.',
    categoryId: 'c2',
    shootTypeIds: ['s3', 's4'],
    spreads: 22,
    minSpreads: 14,
    maxSpreads: 40,
    perSpread: 420,
    price: 19800,
    format: '21×30 см (альбомная)',
    coverUrl: null,
    backCoverUrl: null,
    pages: spreads('a5', 6),
  },
  {
    id: 'a6',
    name: 'Малыши',
    subtitle: 'Ясельная группа',
    desc: 'Компактный альбом для младших групп: короткая съёмка, мягкая обложка, крупные тёплые кадры.',
    categoryId: 'c1',
    shootTypeIds: ['s1'],
    spreads: 12,
    minSpreads: 10,
    maxSpreads: 24,
    perSpread: 350,
    price: 9800,
    format: '20×20 см (квадратная)',
    coverUrl: null,
    backCoverUrl: null,
    pages: spreads('a6', 6),
  },
]

/** Книги на главной — первые три альбома каталога. */
export const featuredAlbumIds = ['a1', 'a2', 'a3']

export const reviews: Review[] = [
  {
    id: 'r1',
    name: 'Айлана О.',
    role: 'Мама выпускника, школа №2',
    rating: 5,
    text: 'Альбом получился лучше, чем мы ожидали. Дети рассматривают его каждый день, а качество печати такое, что не стыдно показать родственникам.',
    createdAt: '2026-05-28',
  },
  {
    id: 'r2',
    name: 'Сергей В.',
    role: 'Председатель родительского комитета',
    rating: 5,
    text: 'Организовали съёмку всего класса за один день, никого не пропустили. Согласование макета шло быстро, правки внесли без споров.',
    createdAt: '2026-06-04',
  },
  {
    id: 'r3',
    name: 'Чечена М.',
    role: 'Воспитатель, детский сад «Салгал»',
    rating: 5,
    text: 'Работали с малышами терпеливо и спокойно — а это непросто. Кадры живые, дети на них настоящие, а не напряжённые.',
    createdAt: '2026-06-11',
  },
]

export const about: About = {
  fio: 'Иванов Александр',
  role: 'Фотограф, автор альбомов',
  desc: 'Снимаю выпускные альбомы для школ и детских садов Тувы. Сам делаю съёмку, вёрстку и сборку книги — от первого кадра до готового альбома в руках. Работаю так, чтобы через десять лет его хотелось открыть снова.',
  photoUrl: null,
  phone: CONTACT_PHONE,
  email: CONTACT_EMAIL,
  address: 'Республика Тыва, г. Кызыл',
  tg: 'https://t.me/tuvafoto',
  vk: 'https://vk.com/tuvafoto',
}

/** Слайды hero-карусели. Реальные фото зальются через админку. */
export const heroSlides = [
  { id: 'hero-1', label: 'Выпускной класс на съёмке' },
  { id: 'hero-2', label: 'Разворот готового альбома' },
  { id: 'hero-3', label: 'Портрет выпускницы' },
  { id: 'hero-4', label: 'Детский сад, утренник' },
]

export const categoryById = (id: string) => categories.find((c) => c.id === id)
export const albumById = (id: string) => albums.find((a) => a.id === id)
export const shootLabels = (ids: string[]) =>
  ids
    .map((id) => shootTypes.find((s) => s.id === id)?.label)
    .filter(Boolean)
    .join(' + ')
