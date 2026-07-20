import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Photo } from '@/components/Photo'
import { authApi, showcaseApi } from '@/lib/api'
import { formatPrice } from '@/domain/pricing'

export function CatalogPage() {
  // Фильтр (slug категории) живёт в URL: ссылку можно переслать, и «назад» работает.
  const [params, setParams] = useSearchParams()
  const active = params.get('cat') ?? 'all'

  // Категории (порядок/названия) и альбомы — из БД.
  const { data: options } = useQuery({ queryKey: ['catalog-options'], queryFn: authApi.catalogOptions })
  const { data: albums, isLoading } = useQuery({ queryKey: ['albums'], queryFn: () => showcaseApi.albums() })

  const categories = options?.categories ?? []
  const tabs = [{ slug: 'all', name: 'Все альбомы' }, ...categories.map((c) => ({ slug: c.slug, name: c.name }))]

  const shown = active === 'all' ? (albums ?? []) : (albums ?? []).filter((a) => a.categorySlug === active)

  return (
    <div className="animate-fade-up mx-auto max-w-[1240px] px-4 pt-[70px] pb-[100px] md:px-10">
      <div className="mb-3.5 font-mono text-[13px] font-bold tracking-[.14em] text-gold uppercase">
        Каталог
      </div>
      <h1 className="font-display m-0 mb-2.5 text-[32px] leading-[1.03] font-extrabold md:text-[48px]">
        Готовые альбомы
      </h1>
      <p className="m-0 mb-9 max-w-[560px] text-base text-white/60">
        Выберите категорию — под каждую ступень подобрана своя стилистика съёмки и оформления.
      </p>

      <div className="scrollx mb-10 flex gap-2.5 overflow-x-auto pb-1.5">
        {tabs.map((t) => (
          <button
            key={t.slug}
            type="button"
            onClick={() => (t.slug === 'all' ? setParams({}) : setParams({ cat: t.slug }))}
            aria-pressed={active === t.slug}
            className={`flex-none cursor-pointer rounded-full border px-5 py-3 text-[13px] font-semibold whitespace-nowrap transition-colors ${
              active === t.slug
                ? 'border-gold bg-gold text-on-gold'
                : 'border-white/[.14] bg-white/[.04] text-white/70 hover:border-gold hover:text-gold'
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-white/50">Загружаем альбомы…</p>
      ) : shown.length === 0 ? (
        <p className="text-white/50">В этой категории пока нет альбомов.</p>
      ) : (
        <div className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
          {shown.map((a) => (
            <div
              key={a.id}
              className="overflow-hidden rounded-[20px] border border-white/[.07] bg-surface-2 transition-colors hover:border-gold/40"
            >
              <Link to={`/album/${a.id}`} className="relative block h-[230px]">
                <Photo src={a.coverUrl} alt={`Обложка альбома «${a.name}»`} placeholder={a.name} />
                <div className="pointer-events-none absolute top-3 left-3 rounded-full bg-[rgba(11,11,14,.75)] px-3 py-1.5 text-[11px] font-semibold tracking-[.04em] text-gold backdrop-blur-[6px]">
                  {a.categoryName}
                </div>
              </Link>
              <div className="p-[22px]">
                <Link
                  to={`/album/${a.id}`}
                  className="font-display mb-3.5 block text-xl leading-[1.15] font-bold text-bone hover:text-gold"
                >
                  {a.name}
                </Link>
                <div className="mb-[18px] flex flex-col gap-2">
                  <div className="flex justify-between gap-3 text-[13px]">
                    <span className="text-white/50">Съёмка</span>
                    <span className="text-right font-semibold">{a.shootTypes.join(', ') || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-[13px]">
                    <span className="text-white/50">Развороты</span>
                    <span className="font-semibold">{a.spreadsCount}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2.5">
                  <div className="font-display text-[22px] leading-none font-bold">
                    {formatPrice(a.price)}
                  </div>
                  <Link
                    to={`/constructor?album=${a.id}`}
                    className="rounded-full border border-gold/40 bg-gold/[.12] px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap text-gold transition-colors hover:bg-gold/25 hover:text-gold"
                  >
                    В конструктор
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
