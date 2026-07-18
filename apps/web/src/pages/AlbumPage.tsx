import { Link, useParams } from 'react-router-dom'
import { Book } from '@/components/Book'
import { albumById, categoryById, CONTACT_PHONE_HREF, shootLabels } from '@/domain/demoData'
import { formatPrice } from '@/domain/pricing'

export function AlbumPage() {
  const { id } = useParams<{ id: string }>()
  const album = id ? albumById(id) : undefined

  if (!album) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-[100px] text-center md:px-10">
        <h1 className="font-display m-0 mb-4 text-[32px] font-extrabold">Альбом не найден</h1>
        <p className="mb-8 text-white/55">Возможно, его убрали из каталога.</p>
        <Link to="/catalog" className="font-semibold">
          ← Вернуться в каталог
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-fade-up mx-auto max-w-[1240px] px-4 pt-10 pb-[100px] md:px-10">
      <Link
        to="/catalog"
        className="mb-9 inline-block text-sm font-semibold text-white/60 hover:text-gold"
      >
        ← Назад в каталог
      </Link>

      <div className="flex flex-wrap items-start gap-[70px]">
        <div className="flex flex-[1_1_480px] justify-center pt-5">
          <Book
            title={album.name}
            subtitle={album.subtitle}
            pw={320}
            ph={224}
            pages={album.pages}
            coverUrl={album.coverUrl}
            backCoverUrl={album.backCoverUrl}
          />
        </div>

        <div className="flex-[1_1_360px]">
          <div className="mb-[18px] inline-block rounded-full bg-gold/[.12] px-3.5 py-1.5 text-xs font-semibold text-gold">
            {categoryById(album.categoryId)?.name}
          </div>
          <h1 className="font-display m-0 mb-[18px] text-[32px] leading-[1.05] font-extrabold md:text-[40px]">
            {album.name}
          </h1>
          <p className="m-0 mb-[30px] text-base leading-[1.7] text-white/70">{album.desc}</p>

          <div className="mb-[30px] flex flex-col gap-3.5 border-y border-white/[.09] py-[22px]">
            <div className="flex justify-between gap-4">
              <span className="text-white/50">Вид фотосессии</span>
              <span className="text-right font-semibold">{shootLabels(album.shootTypeIds)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-white/50">Количество разворотов</span>
              <span className="font-semibold">{album.spreads}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-white/50">Формат</span>
              <span className="font-semibold">{album.format}</span>
            </div>
          </div>

          <div className="mb-1 text-[13px] text-white/50">Стоимость от</div>
          <div className="font-display mb-7 text-[40px] leading-none font-extrabold">
            {formatPrice(album.price)}
          </div>

          <div className="flex flex-wrap gap-3.5">
            <Link
              to={`/constructor?album=${album.id}`}
              className="rounded-full bg-gold px-[30px] py-4 text-[15px] font-bold text-on-gold transition-colors hover:bg-gold-hover hover:text-on-gold"
            >
              Добавить в конструктор
            </Link>
            <a
              href={CONTACT_PHONE_HREF}
              className="inline-flex items-center gap-2 rounded-full border border-white/[.16] bg-white/[.06] px-[26px] py-4 text-[15px] font-semibold text-bone hover:text-bone"
            >
              ☏ Обсудить
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
