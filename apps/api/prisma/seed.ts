/**
 * Сид: заводит владельца и стартовый справочник.
 * Идемпотентен — гоняется повторно без дублей (upsert по естественным ключам).
 *
 * Запуск: npm run seed --workspace apps/api
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import * as argon2 from 'argon2'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

async function seedOwner() {
  // Email приводим к нижнему регистру: вход нормализует ввод так же, иначе
  // «Tuvafoto@…» в базе и «tuvafoto@…» из формы не совпадут и владелец не войдёт.
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase()
  const password = process.env.OWNER_PASSWORD
  const name = process.env.OWNER_NAME ?? 'Владелец'

  if (!email || !password) {
    throw new Error('OWNER_EMAIL и OWNER_PASSWORD обязательны — задайте их в apps/api/.env')
  }

  // Владелец в системе один. Если он уже есть — ничего не создаём и не трогаем,
  // даже если владелец сменил свой email на отличный от OWNER_EMAIL. Иначе
  // повторный сид плодил бы дубль-владельца с заводским паролем.
  const existingOwner = await prisma.user.findFirst({ where: { role: 'OWNER' } })
  if (existingOwner) {
    console.log(`· Владелец уже есть (${existingOwner.email}), пропускаем`)
    return
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id })

  const owner = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: 'OWNER',
      emailVerifiedAt: new Date(),
      // Заводскими доступами пользоваться нельзя — при первом входе сменит.
      mustChangeCredentials: true,
      // А сразу после — заполнит данные о себе для блока «О фотографе».
      mustCompleteProfile: true,
    },
  })

  console.log(`✓ Владелец создан: ${owner.email}`)
}

async function seedCategories() {
  const categories = [
    { slug: 'kindergarten', name: 'Детский сад', sortOrder: 1 },
    { slug: 'primary', name: 'Начальная школа', sortOrder: 2 },
    { slug: 'senior', name: 'Старшеклассники', sortOrder: 3 },
  ]

  for (const c of categories) {
    await prisma.category.upsert({ where: { slug: c.slug }, create: c, update: { name: c.name } })
  }
  console.log(`✓ Категории: ${categories.length}`)
}

async function seedShootTypes() {
  const shoots = [
    { label: 'Классическая', description: 'Портреты и общее фото класса в интерьере школы', price: 6500, sortOrder: 1 },
    { label: 'Студийная', description: 'Съёмка в студии со светом и реквизитом', price: 9500, sortOrder: 2 },
    { label: 'Выездная', description: 'Локация на природе или в городе', price: 11000, sortOrder: 3 },
    { label: 'Репортаж', description: 'Живые кадры с занятий, репетиций и праздника', price: 8000, sortOrder: 4 },
  ]

  // У ShootType нет естественного уникального ключа, поэтому заполняем только
  // на пустой таблице — иначе повторный сид наплодил бы дубли.
  if ((await prisma.shootType.count()) === 0) {
    await prisma.shootType.createMany({ data: shoots })
    console.log(`✓ Виды съёмки: ${shoots.length}`)
  } else {
    console.log('· Виды съёмки уже заведены, пропускаем')
  }
}

async function seedCoverVariants() {
  const covers = [
    { label: 'Классика', priceMod: 0, sortOrder: 1 },
    { label: 'Кожа', priceMod: 900, sortOrder: 2 },
    { label: 'Лён', priceMod: 700, sortOrder: 3 },
    { label: 'Дерево', priceMod: 1500, sortOrder: 4 },
    { label: 'Бархат', priceMod: 1200, sortOrder: 5 },
    { label: 'Тиснение золотом', priceMod: 2200, sortOrder: 6 },
  ]

  if ((await prisma.coverVariant.count()) === 0) {
    await prisma.coverVariant.createMany({ data: covers })
    console.log(`✓ Варианты обложек: ${covers.length}`)
  } else {
    console.log('· Обложки уже заведены, пропускаем')
  }
}

/**
 * Привязка обложек и видов съёмки к категориям (детсад/школа/…). Идемпотентно:
 * каждый раз переустанавливаем наборы через set. Обложки и виды съёмки должны
 * быть засеяны раньше.
 */
async function seedCategoryCovers() {
  const covers = await prisma.coverVariant.findMany({ select: { id: true, label: true } })
  const shoots = await prisma.shootType.findMany({ select: { id: true, label: true } })
  const coversByLabel = (labels: string[]) =>
    covers.filter((c) => labels.includes(c.label)).map((c) => ({ id: c.id }))
  const shootsByLabel = (labels: string[]) =>
    shoots.filter((s) => labels.includes(s.label)).map((s) => ({ id: s.id }))

  const config: {
    slug: string
    allowCover: boolean
    coverLabels: string[]
    shootLabels: string[]
  }[] = [
    {
      slug: 'kindergarten',
      allowCover: true,
      coverLabels: ['Классика', 'Лён', 'Бархат'],
      shootLabels: ['Классическая', 'Студийная'],
    },
    {
      slug: 'primary',
      allowCover: true,
      coverLabels: ['Классика', 'Кожа', 'Дерево', 'Тиснение золотом'],
      shootLabels: ['Классическая', 'Выездная', 'Репортаж'],
    },
    // У старшеклассников обложку не выбирают, зато доступны все виды съёмки.
    {
      slug: 'senior',
      allowCover: false,
      coverLabels: [],
      shootLabels: ['Классическая', 'Студийная', 'Выездная', 'Репортаж'],
    },
  ]

  for (const c of config) {
    await prisma.category.update({
      where: { slug: c.slug },
      data: {
        allowCover: c.allowCover,
        coverVariants: { set: coversByLabel(c.coverLabels) },
        shootTypes: { set: shootsByLabel(c.shootLabels) },
      },
    })
  }
  console.log('✓ Обложки и виды съёмки привязаны к категориям')
}

async function seedAbout() {
  await prisma.about.upsert({
    where: { id: 'about' },
    create: {
      id: 'about',
      fio: 'Иванов Александр',
      role: 'Фотограф, автор альбомов',
      desc: 'Снимаю выпускные альбомы для школ и детских садов Тувы. Сам делаю съёмку, вёрстку и сборку книги — от первого кадра до готового альбома в руках.',
      phone: '+7 923 388 27 07',
      email: 'Tuvafoto@mail.ru',
      address: 'Республика Тыва, г. Кызыл',
    },
    update: {},
  })
  console.log('✓ Блок «О фотографе»')
}

async function main() {
  await seedOwner()
  await seedCategories()
  await seedShootTypes()
  await seedCoverVariants()
  await seedCategoryCovers()
  await seedAbout()
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('Сид упал:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
