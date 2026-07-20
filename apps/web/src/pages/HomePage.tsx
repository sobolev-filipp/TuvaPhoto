import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Book } from '@/components/Book'
import { Photo } from '@/components/Photo'
import { useQuery } from '@tanstack/react-query'
import { heroSlides, reviews as demoReviews } from '@/domain/demoData'
import { showcaseApi } from '@/lib/api'
import type { Review } from '@/domain/types'
import { useAbout } from '@/domain/useAbout'
import { ReviewModal } from '@/components/ReviewModal'
import { Toast, useToast } from '@/components/Toast'

const HERO_INTERVAL_MS = 4200

function Hero() {
  const [slide, setSlide] = useState(0)
  const { data: about } = useAbout()

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % heroSlides.length), HERO_INTERVAL_MS)
    return () => clearInterval(t)
  }, [])

  return (
    <section className="relative h-[540px] overflow-hidden md:h-[560px] min-[901px]:h-[640px]">
      {heroSlides.map((h, i) => (
        <div
          key={h.id}
          className="absolute inset-0 transition-opacity duration-[1100ms]"
          style={{ opacity: i === slide ? 1 : 0, zIndex: i === slide ? 2 : 1 }}
        >
          <Photo src={null} alt="" placeholder={h.label} loading={i === 0 ? 'eager' : 'lazy'} />
        </div>
      ))}

      <div
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          background:
            'linear-gradient(90deg,rgba(11,11,14,.92) 0%,rgba(11,11,14,.55) 45%,rgba(11,11,14,.15) 100%),linear-gradient(0deg,rgba(11,11,14,.9),transparent 40%)',
        }}
      />

      <div className="absolute inset-0 z-[6] flex items-center">
        <div className="mx-auto w-full max-w-[1240px] px-4 md:px-10">
          <div className="max-w-[620px]">
            <div className="mb-[26px] inline-flex items-center gap-2 rounded-full border border-gold/40 px-3.5 py-[7px] text-xs font-semibold tracking-[.12em] text-gold uppercase">
              Выпускные фотоальбомы
            </div>
            <h1 className="font-display m-0 mb-[22px] text-[27px] leading-[1.02] font-extrabold tracking-[-.01em] min-[421px]:text-[32px] min-[681px]:text-[46px] min-[1025px]:text-[62px]">
              Память, которую
              <br />
              хочется<span className="text-gold"> листать</span>
            </h1>
            <p className="m-0 mb-9 max-w-[500px] text-base leading-relaxed text-white/70 md:text-lg">
              Авторские фотокниги для выпускных классов и детских садов. Печать премиум-качества,
              собственное изготовление, большой выбор вариантов обложек.
            </p>
            {/* На мобильном кнопки растягиваются на всю ширину и идут столбиком,
                с планшета — обычная пара пилюль по содержимому. */}
            <div className="flex flex-col gap-3.5 sm:flex-row sm:flex-wrap">
              <Link
                to="/constructor"
                className="block w-full rounded-full bg-gold px-[30px] py-4 text-center text-[15px] font-bold text-on-gold transition-colors hover:bg-gold-hover hover:text-on-gold sm:w-auto"
              >
                Заказать альбом
              </Link>
              {about?.phoneHref && (
                <a
                  href={about.phoneHref}
                  className="block w-full rounded-full border border-white/[.16] bg-white/[.06] px-[26px] py-4 text-center text-[15px] font-semibold text-bone hover:text-bone sm:w-auto"
                >
                  Позвонить фотографу
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-[30px] z-[7] flex justify-center gap-2.5">
        {heroSlides.map((h, i) => (
          <button
            key={h.id}
            type="button"
            onClick={() => setSlide(i)}
            aria-label={`Слайд ${i + 1}: ${h.label}`}
            aria-current={i === slide}
            className="h-1.5 rounded-md border-none transition-all duration-[400ms]"
            style={{
              width: i === slide ? 28 : 8,
              background: i === slide ? '#E4B45C' : 'rgba(255,255,255,.3)',
            }}
          />
        ))}
      </div>
    </section>
  )
}

export function HomePage() {
  const [reviews, setReviews] = useState<Review[]>(demoReviews)
  const [modalOpen, setModalOpen] = useState(false)
  const { toast, show } = useToast()

  const { data: featured = [] } = useQuery({
    queryKey: ['albums', 'featured'],
    queryFn: showcaseApi.featured,
  })

  const addReview = (review: Review) => {
    setReviews((prev) => [review, ...prev])
    setModalOpen(false)
    show('Спасибо! Отзыв опубликован.')
  }

  return (
    <div className="animate-fade-up">
      <Hero />

      {/* Книги */}
      <section className="mx-auto max-w-[1240px] px-4 pt-[100px] pb-[60px] md:px-10">
        <div className="mb-3 flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <div className="mb-3.5 font-mono text-[13px] font-bold tracking-[.14em] text-gold uppercase">
              Наши работы
            </div>
            <h2 className="font-display m-0 text-[26px] leading-[1.05] font-bold md:text-[42px]">
              Полистайте альбомы
            </h2>
          </div>
          <Link
            to="/catalog"
            className="block w-full rounded-full border border-white/20 px-6 py-3.5 text-center text-sm font-semibold text-bone transition-colors hover:border-gold hover:text-gold sm:w-auto"
          >
            Весь каталог →
          </Link>
        </div>
        <p className="m-0 mb-12 max-w-[560px] text-[15px] text-white/55">
          Нажмите на обложку, чтобы открыть книгу, и листайте развороты стрелками — как настоящий
          альбом.
        </p>

        {/* Книги обычного размера (pw 210 → сцена 2×210+40 = 460): в широкий ряд
            помещается две. Пока влезает одна — она по центру; как только влезает
            вторая (порог 2×460+56 = 976) — ряд по левому краю (макет).
            Container query меряет контентную ширину секции. */}
        <div className="@container">
          <div className="flex flex-wrap justify-center gap-14 @min-[976px]:justify-start">
            {featured.map((b) => {
              const size = b.orientation === 'PORTRAIT' ? { pw: 150, ph: 205 } : { pw: 210, ph: 147 }
              const pages = b.spreads.map((s, i) => ({
                id: `${b.id}-${i}`,
                label: s.label,
                imageUrl: s.imageUrl,
                layout: s.layout,
                rightImageUrl: s.rightImageUrl,
              }))
              return (
                <div key={b.id} className="flex flex-col items-center gap-[18px]">
                  <Book
                    title={b.name}
                    subtitle={b.subtitle}
                    pw={size.pw}
                    ph={size.ph}
                    pages={pages}
                    coverUrl={b.coverUrl}
                    backCoverUrl={b.backCoverUrl}
                  />
                  <Link
                    to={`/album/${b.id}`}
                    className="text-[13px] font-semibold tracking-[.04em] text-white/60 hover:text-gold"
                  >
                    Подробнее об альбоме →
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Отзывы */}
      <section className="mt-[60px] border-t border-white/[.07]">
        <div className="mx-auto max-w-[1240px] px-4 py-[90px] md:px-10">
          <div className="mb-11 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-3.5 font-mono text-[13px] font-bold tracking-[.14em] text-gold uppercase">
                Отзывы
              </div>
              <h2 className="font-display m-0 text-[26px] leading-[1.05] font-bold md:text-[42px]">
                Что говорят родители
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-full bg-gold px-[26px] py-3.5 text-sm font-bold text-on-gold transition-colors hover:bg-gold-hover"
            >
              Оставить отзыв
            </button>
          </div>

          <div className="grid gap-[22px] [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-[18px] border border-white/[.07] bg-surface-2 p-7">
                <div
                  className="mb-4 text-[15px] tracking-[3px] text-gold"
                  aria-label={`Оценка: ${r.rating} из 5`}
                >
                  {'★'.repeat(r.rating)}
                  <span className="text-white/20">{'★'.repeat(5 - r.rating)}</span>
                </div>
                <p className="m-0 mb-[22px] text-[15px] leading-[1.65] text-white/80">{r.text}</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#2a2a30,#161619)] font-bold text-gold">
                    {r.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-bold">{r.name}</div>
                    <div className="text-xs text-white/50">{r.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1240px] px-4 pb-[90px] md:px-10">
        <div
          className="flex flex-wrap items-center justify-between gap-[30px] rounded-[26px] border border-gold/20 px-6 py-14 md:px-12"
          style={{ background: 'radial-gradient(120% 160% at 15% 20%,#26241d,#111114)' }}
        >
          <div>
            <h2 className="font-display m-0 mb-3 text-[26px] leading-[1.1] font-bold md:text-[34px]">
              Соберите свой альбом
            </h2>
            <p className="m-0 max-w-[460px] text-base text-white/60">
              Выберите обложку, вид съёмки и количество разворотов — цена посчитается сразу.
            </p>
          </div>
          <Link
            to="/constructor"
            className="rounded-full bg-gold px-[34px] py-[17px] text-base font-bold whitespace-nowrap text-on-gold transition-colors hover:bg-gold-hover hover:text-on-gold"
          >
            Открыть конструктор
          </Link>
        </div>
      </section>

      {modalOpen && <ReviewModal onClose={() => setModalOpen(false)} onSubmit={addReview} />}
      <Toast toast={toast} />
    </div>
  )
}
