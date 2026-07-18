import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LogoMark } from './Logo'
import { Photo } from './Photo'
import type { Spread } from '@/domain/types'

/* ==========================================================================
   Book — реалистичная фотокнига с перелистыванием.
   Портировано с Book.dc.html; тайминги и геометрия сохранены 1:1.

   Модель состояния `flipped`:
     0        — закрыта на передней обложке
     1..n     — открыта, показан разворот с индексом flipped-1
     n+1      — закрыта на задней обложке («конец альбома»)

   Один разворот — это одна фотография целиком на две страницы: она не
   делится и не дублируется, поэтому spread рисуется одним слоем во всю
   ширину, а корешок — накладной тенью поверх.
   ========================================================================== */

/** Подмена фото под листом — в середине поворота, пока лист скрывает разворот. */
const MID_SWAP_MS = 260
/** Полная длительность поворота листа. */
const TURN_MS = 640
/** Задержка перед стартом анимации: даём браузеру закоммитить начальный transform. */
const NEXT_FRAME_MS = 30
/** Интервал автоперелистывания. */
const AUTOPLAY_MS = 1700

/** Запас по бокам сцены: срез страниц и мягкая тень книги. */
const STAGE_PAD = 40
/** Боковые поля страницы — совпадают с паддингом контейнера на мобильном. */
const PAGE_PAD = 16

interface TurnState {
  left: number
  origin: string
  from: string
  to: string
  deg: string
}

export interface BookProps {
  title: string
  subtitle: string
  /** Ширина одной страницы, px. Альбомная ориентация: pw:ph ≈ 210:150. */
  pw?: number
  ph?: number
  pages: Spread[]
  coverUrl?: string | null
  backCoverUrl?: string | null
  className?: string
}

export function Book({
  title,
  subtitle,
  pw: pwProp = 210,
  ph: phProp = 150,
  pages,
  coverUrl,
  backCoverUrl,
  className = '',
}: BookProps) {
  const [flipped, setFlipped] = useState(0)
  const [fs, setFs] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [turn, setTurn] = useState<TurnState | null>(null)

  const n = pages.length
  const flippedRef = useRef(flipped)
  flippedRef.current = flipped

  const timers = useRef<{ raf?: number; mid?: number; turn?: number; play?: number }>({})
  const clearTimers = useCallback(() => {
    const t = timers.current
    if (t.raf) clearTimeout(t.raf)
    if (t.mid) clearTimeout(t.mid)
    if (t.turn) clearTimeout(t.turn)
  }, [])

  /* --- размеры ----------------------------------------------------------
     Книга задаётся в пикселях (две страницы + поле под срез), поэтому на
     узком экране она обязана ужиматься сама: иначе разворот уезжает за край
     вместе с кнопками перелистывания. Пропорция pw:ph сохраняется всегда. */
  const ratio = pwProp / phProp
  // clientWidth, а не innerWidth: innerWidth включает вертикальную полосу
  // прокрутки, и книга получалась на её ширину больше доступного места —
  // ровно настолько страница и уезжала вбок.
  const readViewport = () =>
    typeof document === 'undefined'
      ? { w: 1200, h: 800 }
      : { w: document.documentElement.clientWidth, h: document.documentElement.clientHeight }
  const [viewport, setViewport] = useState(readViewport)
  useLayoutEffect(() => {
    const onResize = () => setViewport(readViewport())
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  let pw = pwProp
  let ph = phProp
  if (fs) {
    ph = Math.min(viewport.h * 0.74, (viewport.w * 0.9) / 2 / ratio)
    pw = ph * ratio
  } else {
    // Книга обязана уместиться в экран целиком: нижней границы у pw нет —
    // любой минимум означал бы горизонтальную прокрутку на узких телефонах.
    const maxPw = (viewport.w - PAGE_PAD * 2 - STAGE_PAD) / 2
    if (maxPw < pwProp) {
      pw = maxPw
      ph = pw / ratio
    }
  }
  // Текст на обложке задан под эталонную страницу 210px: без масштабирования
  // на ужатой книге заголовок вылезает за пределы обложки, а в fullscreen
  // теряется. Границы не дают ему стать нечитаемым или огромным.
  const k = Math.min(1.5, Math.max(0.62, pw / 210))
  const pwRef = useRef(pw)
  pwRef.current = pw

  /* --- перелистывание --------------------------------------------------- */
  const goTo = useCallback(
    (target: number, dir: 'fwd' | 'back') => {
      const clamped = Math.max(0, Math.min(n + 1, target))
      if (clamped === flippedRef.current) return

      const p = pwRef.current
      const start: TurnState =
        dir === 'fwd'
          ? { left: p, origin: 'left center', from: 'rotateY(0deg)', to: 'rotateY(-178deg)', deg: 'rotateY(0deg)' }
          : { left: 0, origin: 'right center', from: 'rotateY(0deg)', to: 'rotateY(178deg)', deg: 'rotateY(0deg)' }

      clearTimers()
      setTurn(start)
      timers.current.raf = window.setTimeout(
        () => setTurn((t) => (t ? { ...t, deg: t.to } : t)),
        NEXT_FRAME_MS,
      )
      timers.current.mid = window.setTimeout(() => setFlipped(clamped), MID_SWAP_MS)
      timers.current.turn = window.setTimeout(() => setTurn(null), TURN_MS)
    },
    [n, clearTimers],
  )

  const stopPlay = useCallback(() => {
    if (timers.current.play) {
      clearInterval(timers.current.play)
      timers.current.play = undefined
    }
    setPlaying(false)
  }, [])

  const startPlay = useCallback(() => {
    if (timers.current.play) clearInterval(timers.current.play)
    timers.current.play = window.setInterval(() => {
      const f = flippedRef.current
      if (f >= n) goTo(0, 'back')
      else goTo(f + 1, 'fwd')
    }, AUTOPLAY_MS)
    setPlaying(true)
  }, [n, goTo])

  useEffect(
    () => () => {
      clearTimers()
      if (timers.current.play) clearInterval(timers.current.play)
    },
    [clearTimers],
  )

  const next = useCallback(() => {
    stopPlay()
    goTo(flippedRef.current + 1, 'fwd')
  }, [stopPlay, goTo])
  const prev = useCallback(() => {
    stopPlay()
    goTo(flippedRef.current - 1, 'back')
  }, [stopPlay, goTo])
  const openCover = useCallback(() => {
    stopPlay()
    if (flippedRef.current === 0) goTo(1, 'fwd')
  }, [stopPlay, goTo])

  /* --- fullscreen: клавиатура и блокировка прокрутки фона ---------------- */
  useEffect(() => {
    if (!fs) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFs(false)
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [fs, next, prev])

  /* --- производные значения --------------------------------------------- */
  const isOpen = flipped >= 1 && flipped <= n
  const closedFront = flipped === 0
  const closedBack = flipped === n + 1
  const cur = isOpen ? flipped - 1 : 0
  const page = pages[cur]

  const doubleW = pw * 2
  const navLabel = isOpen ? `Разворот ${flipped} / ${n}` : closedBack ? 'Конец альбома' : 'Обложка'
  const stageShift = closedFront ? -(pw / 2) : closedBack ? pw / 2 : 0

  const ctrlBtn =
    'flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/15 bg-white/5 text-[15px] text-bone transition-colors hover:border-gold hover:text-gold'

  const content = (
    <div
      onClick={(e) => {
        if (fs && e.target === e.currentTarget) setFs(false)
      }}
      className={
        fs
          ? 'fixed inset-0 z-[9999] flex select-none flex-col items-center justify-center gap-[26px] bg-[rgba(6,6,8,.95)] p-[30px] backdrop-blur-[6px]'
          : `flex select-none flex-col items-center gap-[18px] ${className}`
      }
    >
      {/* У закрытой книги сцена сдвигается на ±pw/2, чтобы обложка встала по
          центру. Видимое при этом остаётся внутри, а вот пустая коробка сцены
          вылезает за край и на узком экране давала горизонтальную прокрутку.
          overflow-x:clip срезает только её (в отличие от hidden не создаёт
          контейнер прокрутки и не ломает sticky), по вертикали тени целы. */}
      <div
        className="flex items-center justify-center [overflow-x:clip] [overflow-y:visible]"
        style={{ perspective: '2800px', width: doubleW + STAGE_PAD, height: ph }}
      >
        <div
          className="relative"
          style={{
            width: doubleW,
            height: ph,
            transformStyle: 'preserve-3d',
            transition: 'transform .6s cubic-bezier(.35,.05,.2,1)',
            transform: `translateX(${stageShift}px)`,
          }}
        >
          {/* Срез страниц по бокам открытой книги — придаёт объём блоку */}
          <div
            className="absolute top-[2.5%] h-[95%] w-2 rounded-l-[3px] transition-opacity duration-[400ms]"
            style={{
              left: -4,
              transform: 'translateZ(-2px)',
              background: 'linear-gradient(90deg,#c7c1b2,#efece4)',
              opacity: isOpen ? 1 : 0,
              boxShadow: '-2px 0 0 #d7d2c4,-4px 1px 0 #cfc9bb,-6px 2px 0 #c7c1b2',
            }}
          />
          <div
            className="absolute top-[2.5%] h-[95%] w-2 rounded-r-[3px] transition-opacity duration-[400ms]"
            style={{
              right: -4,
              transform: 'translateZ(-2px)',
              background: 'linear-gradient(-90deg,#c7c1b2,#efece4)',
              opacity: isOpen ? 1 : 0,
              boxShadow: '2px 0 0 #d7d2c4,4px 1px 0 #cfc9bb,6px 2px 0 #c7c1b2',
            }}
          />

          {/* Стопка страниц закрытой книги (fore-edge) */}
          <div
            className="absolute top-[2.5%] h-[95%] transition-opacity duration-[400ms]"
            style={{
              left: closedBack ? 0 : pw,
              width: pw,
              transform: 'translateZ(-3px)',
              borderRadius: closedBack ? '2px 6px 6px 2px' : '6px 2px 2px 6px',
              background: closedBack
                ? 'linear-gradient(90deg,#efece4,#c7c1b2)'
                : 'linear-gradient(-90deg,#efece4,#c7c1b2)',
              opacity: isOpen ? 0 : 1,
              boxShadow: closedBack
                ? '3px 0 0 #d7d2c4,5px 1px 0 #cfc9bb,7px 2px 0 #c7c1b2,9px 3px 0 #beb8a8,0 24px 50px rgba(0,0,0,.45)'
                : '-3px 0 0 #d7d2c4,-5px 1px 0 #cfc9bb,-7px 2px 0 #c7c1b2,-9px 3px 0 #beb8a8,0 24px 50px rgba(0,0,0,.45)',
            }}
          />

          {/* Разворот: одно фото на всю ширину обеих страниц.
              Закрытая книга: слой невидим, но без pointer-events он продолжал
              бы перехватывать клики по обложке. */}
          <div
            className="absolute top-0 left-0 z-[1] bg-paper p-2 transition-opacity duration-[350ms]"
            style={{
              width: doubleW,
              height: ph,
              opacity: isOpen ? 1 : 0,
              pointerEvents: isOpen ? 'auto' : 'none',
            }}
          >
            <div className="relative h-full w-full overflow-hidden rounded-[2px] shadow-[inset_0_0_0_1px_rgba(0,0,0,.06)]">
              <Photo src={page?.imageUrl} alt={page?.label ?? 'Разворот'} placeholder={page?.label} />
              {/* Тень корешка по центру разворота */}
              <div
                className="pointer-events-none absolute inset-y-0 left-1/2 w-[26px] -translate-x-[13px]"
                style={{
                  background:
                    'linear-gradient(90deg,transparent,rgba(0,0,0,.16),rgba(0,0,0,.05) 52%,rgba(0,0,0,.16),transparent)',
                }}
              />
              {/* Клик по странице открывает fullscreen. У закрытой книги кнопки
                  нет вовсе: иначе она осталась бы в дереве доступности и в
                  порядке табуляции поверх обложки. */}
              {!fs && isOpen && (
                <button
                  type="button"
                  onClick={() => setFs(true)}
                  aria-label="Открыть книгу во весь экран"
                  className="absolute inset-0 cursor-zoom-in"
                />
              )}
            </div>
          </div>

          {/* Транзитный лист: поворачивается, пока под ним меняется фото */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 z-[60]"
            style={{
              left: turn?.left ?? 0,
              width: pw,
              height: ph,
              display: turn ? 'block' : 'none',
              transformOrigin: turn?.origin ?? 'left center',
              transformStyle: 'preserve-3d',
              transform: turn?.deg ?? 'rotateY(0deg)',
              transition:
                turn && turn.deg !== turn.from ? 'transform .6s cubic-bezier(.4,.05,.2,1)' : 'none',
            }}
          >
            <div
              className="absolute inset-0 rounded-[2px_6px_6px_2px] shadow-[0_22px_46px_rgba(0,0,0,.4)] [backface-visibility:hidden]"
              style={{ background: 'linear-gradient(90deg,#f1eee6,#e6e2d8)' }}
            />
            <div
              className="absolute inset-0 rounded-[6px_2px_2px_6px] shadow-[0_22px_46px_rgba(0,0,0,.4)] [backface-visibility:hidden] [transform:rotateY(180deg)]"
              style={{ background: 'linear-gradient(-90deg,#f1eee6,#e6e2d8)' }}
            />
          </div>

          {/* Передняя обложка. В открытом состоянии гасим, чтобы изнанка
              не перекрывала фото разворота. */}
          <div
            className="absolute top-0"
            style={{
              left: pw,
              width: pw,
              height: ph,
              transformOrigin: 'left center',
              transformStyle: 'preserve-3d',
              transition: 'transform .8s cubic-bezier(.4,.05,.2,1),opacity .4s ease',
              transform: closedFront ? 'rotateY(0deg)' : 'rotateY(-180deg)',
              opacity: closedFront ? 1 : 0,
              pointerEvents: closedFront ? 'auto' : 'none',
              zIndex: closedFront ? 80 : 5,
            }}
          >
            <div
              onClick={openCover}
              role="button"
              tabIndex={closedFront ? 0 : -1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openCover()
                }
              }}
              aria-label={`Открыть альбом «${title}»`}
              className="absolute inset-0 cursor-pointer overflow-hidden rounded-[2px_6px_6px_2px] bg-surface-warm shadow-[0_22px_48px_rgba(0,0,0,.45)] [backface-visibility:hidden]"
            >
              <Photo src={coverUrl} alt={`Обложка альбома «${title}»`} placeholder="Обложка альбома" />
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'linear-gradient(180deg,rgba(10,9,12,.5) 0%,transparent 32%,transparent 52%,rgba(10,9,12,.88) 100%)',
                }}
              />
              <div
                className="pointer-events-none absolute flex items-center justify-between"
                style={{ top: 20 * k, left: 20 * k, right: 20 * k }}
              >
                <span
                  className="font-display leading-none font-bold tracking-[.02em] text-gold"
                  style={{ fontSize: 11 * k }}
                >
                  ТуваФото
                </span>
                <span className="flex items-center justify-center text-gold">
                  <LogoMark height={22 * k} />
                </span>
              </div>
              <div
                className="pointer-events-none absolute"
                style={{ bottom: 20 * k, left: 22 * k, right: 22 * k }}
              >
                <div
                  className="font-display leading-[1.1] font-semibold text-bone"
                  style={{ fontSize: 22 * k }}
                >
                  {title}
                </div>
                <div
                  className="font-medium text-white/70"
                  style={{ fontSize: 11 * k, lineHeight: 1.4, marginTop: 6 * k }}
                >
                  {subtitle}
                </div>
                <div
                  className="animate-book-hint font-mono tracking-[.14em] text-gold/90 uppercase"
                  style={{ fontSize: 9 * k, marginTop: 12 * k }}
                >
                  Нажмите, чтобы открыть →
                </div>
              </div>
            </div>
            <div
              className="absolute inset-0 rounded-[6px_2px_2px_6px] shadow-[0_22px_48px_rgba(0,0,0,.4)] [backface-visibility:hidden] [transform:rotateY(180deg)]"
              style={{ background: 'linear-gradient(-90deg,#e3dfd4,#f1eee6)' }}
            />
          </div>

          {/* Задняя обложка */}
          <div
            className="absolute top-0 left-0"
            style={{
              width: pw,
              height: ph,
              transformOrigin: 'right center',
              transformStyle: 'preserve-3d',
              transition: 'transform .8s cubic-bezier(.4,.05,.2,1),opacity .4s ease',
              transform: closedBack ? 'rotateY(0deg)' : 'rotateY(180deg)',
              opacity: closedBack ? 1 : 0,
              pointerEvents: closedBack ? 'auto' : 'none',
              zIndex: closedBack ? 80 : 4,
            }}
          >
            <div className="absolute inset-0 overflow-hidden rounded-[6px_2px_2px_6px] bg-surface-warm shadow-[0_22px_48px_rgba(0,0,0,.45)] [backface-visibility:hidden]">
              <Photo src={backCoverUrl} alt="Задняя обложка" placeholder="Задняя обложка" />
              <div
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
                style={{
                  background: 'linear-gradient(180deg,rgba(10,9,12,.42),rgba(10,9,12,.86))',
                  gap: 9 * k,
                  padding: 24 * k,
                }}
              >
                <span
                  className="font-display leading-none font-bold text-gold"
                  style={{ fontSize: 13 * k }}
                >
                  ТуваФото
                </span>
                <span
                  className="font-medium text-white/[.78]"
                  style={{ fontSize: 10 * k, lineHeight: 1.5 }}
                >
                  Спасибо, что выбрали нас.
                  <br />
                  Ваши воспоминания — наша работа.
                </span>
              </div>
            </div>
            <div
              className="absolute inset-0 rounded-[2px_6px_6px_2px] shadow-[0_22px_48px_rgba(0,0,0,.4)] [backface-visibility:hidden] [transform:rotateY(180deg)]"
              style={{ background: 'linear-gradient(90deg,#e3dfd4,#f1eee6)' }}
            />
          </div>
        </div>
      </div>

      {/* Управление всегда в две строки по центру: листание сверху, режимы
          снизу. Так блок кнопок узкий и в ряд помещается больше книг. */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={prev} aria-label="Предыдущий разворот" className={ctrlBtn}>
            ‹
          </button>
          <span
            aria-live="polite"
            className="min-w-[110px] text-center font-mono text-[11px] leading-none font-semibold tracking-[.08em] text-white/55"
          >
            {navLabel}
          </span>
          <button type="button" onClick={next} aria-label="Следующий разворот" className={ctrlBtn}>
            ›
          </button>
        </div>
        <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => (playing ? stopPlay() : startPlay())}
          aria-pressed={playing}
          className={`h-[38px] rounded-full border px-4 text-xs font-semibold whitespace-nowrap transition-colors ${
            playing
              ? 'border-gold bg-gold/15 text-gold'
              : 'border-white/15 bg-white/5 text-white/80 hover:border-gold hover:text-gold'
          }`}
        >
          {playing ? '⏸  Стоп' : '▶  Старт'}
        </button>
        <button
          type="button"
          onClick={() => setFs((v) => !v)}
          className="h-[38px] rounded-full border border-white/15 bg-white/5 px-4 text-xs font-semibold whitespace-nowrap text-white/80 transition-colors hover:border-gold hover:text-gold"
        >
          {fs ? '✕  Закрыть' : '⛶  Во весь экран'}
        </button>
        </div>
      </div>
    </div>
  )

  // Полноэкранный слой уходит порталом в body: страницы обёрнуты в анимацию
  // opacity, а она создаёт stacking context — внутри него никакой z-index не
  // поднимет оверлей над sticky-шапкой.
  return fs ? createPortal(content, document.body) : content
}
