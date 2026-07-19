import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Book } from '@/components/Book'
import { Photo } from '@/components/Photo'
import { Modal } from '@/components/Modal'
import { Toast, useToast } from '@/components/Toast'
import { PhoneField, isPhoneComplete } from '@/components/auth/PhoneField'
import { ApiError, authApi } from '@/lib/api'
import {
  DEFAULT_PER_SPREAD,
  formatPrice,
  minPrepay,
  pluralSpreads,
  PREPAY_PERCENTS,
  prepayDue,
  type PrepayChoice,
} from '@/domain/pricing'

const MIN_SPREADS = 10
const MAX_SPREADS = 40

/** Пресеты заполняют параметры по клику на «Применить». Клик по книге пресета
 *  ничего не применяет — только отдельная кнопка (иначе конфликт с листанием). */
const PRESETS = [
  { id: 'classic', name: 'Классический', subtitle: 'База', spreads: 16, shootLabels: ['Классическая'], coverLabel: 'Классика' },
  { id: 'studio', name: 'Студийный', subtitle: 'Свет и характер', spreads: 20, shootLabels: ['Классическая', 'Студийная'], coverLabel: 'Кожа' },
  { id: 'premium', name: 'Премиум', subtitle: 'Всё включено', spreads: 28, shootLabels: ['Классическая', 'Студийная', 'Репортаж'], coverLabel: 'Тиснение золотом' },
]

const blankPages = (base: string) =>
  Array.from({ length: 6 }, (_, i) => ({ id: `${base}-P${i}`, label: `Разворот ${i + 1}`, imageUrl: null }))

type PrepayKind = 'percent' | 'full' | 'custom'
type PayMethod = 'SBP' | 'BANK'

export function ConstructorPage() {
  const { toast, show } = useToast()
  const { data: options, isLoading } = useQuery({
    queryKey: ['catalog-options'],
    queryFn: authApi.catalogOptions,
  })

  const [cover, setCover] = useState<string | null>(null)
  const [shoots, setShoots] = useState<string[]>([])
  const [spreads, setSpreads] = useState(20)
  const [prepayKind, setPrepayKind] = useState<PrepayKind>('percent')
  const [prepayPercent, setPrepayPercent] = useState(50)
  const [customAmount, setCustomAmount] = useState('')
  const [applied, setApplied] = useState<string | null>(null)

  const [fio, setFio] = useState('')
  const [school, setSchool] = useState('')
  const [phone, setPhone] = useState('')

  const [payOpen, setPayOpen] = useState(false)
  const [payMethod, setPayMethod] = useState<PayMethod>('SBP')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const shootTypes = options?.shootTypes ?? []
  const coverVariants = options?.coverVariants ?? []

  const selectedShoots = shootTypes.filter((s) => shoots.includes(s.id))
  const selectedCover = coverVariants.find((c) => c.id === cover) ?? null

  const price = useMemo(() => {
    const priceShoots = selectedShoots.reduce((a, s) => a + s.price, 0)
    const priceSpreads = spreads * DEFAULT_PER_SPREAD
    const priceCover = selectedCover?.priceMod ?? 0
    const total = priceShoots + priceSpreads + priceCover
    return { priceShoots, priceSpreads, priceCover, total }
  }, [selectedShoots, spreads, selectedCover])

  const minDue = minPrepay(price.total)
  const customNum = Number(customAmount)
  const prepayChoice: PrepayChoice =
    prepayKind === 'full'
      ? { kind: 'full' }
      : prepayKind === 'custom'
        ? { kind: 'custom', amount: customNum }
        : { kind: 'percent', percent: prepayPercent }
  const due = prepayDue(price.total, prepayChoice)
  // Своя сумма валидна, если в диапазоне [20%..итог]; для пресетов/полной — всегда.
  const customValid =
    prepayKind !== 'custom' || (Number.isFinite(customNum) && customNum >= minDue && customNum <= price.total)

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setShoots(shootTypes.filter((s) => preset.shootLabels.includes(s.label)).map((s) => s.id))
    const c = coverVariants.find((cv) => cv.label === preset.coverLabel)
    setCover(c?.id ?? null)
    setSpreads(Math.min(MAX_SPREADS, Math.max(MIN_SPREADS, preset.spreads)))
    setApplied(preset.id)
  }

  const toggleShoot = (id: string) => {
    setApplied(null)
    setShoots((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const canSubmit =
    shoots.length > 0 &&
    customValid &&
    fio.trim().length >= 2 &&
    school.trim().length >= 2 &&
    isPhoneComplete(phone)

  const submitOrder = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await authApi.createOrder({
        fio: fio.trim(),
        school: school.trim(),
        phone: `+7${phone}`,
        coverVariantId: cover,
        shootTypeIds: shoots,
        spreads,
        payType: prepayKind === 'full' ? 'FULL' : 'PREPAY',
        ...(prepayKind === 'percent' ? { prepayPercent } : {}),
        ...(prepayKind === 'custom' ? { prepayAmount: customNum } : {}),
        payMethod,
      })
      setPayOpen(false)
      show(`Заказ №${res.number} оформлен! Мы свяжемся с вами.`)
      // Сбрасываем контакты, конфигурацию оставляем.
      setFio('')
      setSchool('')
      setPhone('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось оформить заказ')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="animate-fade-up mx-auto max-w-[1240px] px-4 pt-[60px] pb-[100px] sm:px-6 md:px-10 md:pt-[70px]">
      <div className="mb-3.5 font-mono text-[13px] font-bold tracking-[.14em] text-gold uppercase">
        Конструктор
      </div>
      <h1 className="font-display m-0 mb-2.5 text-[28px] leading-[1.03] font-extrabold min-[420px]:text-[36px] md:text-[48px]">
        Соберите свой альбом
      </h1>
      <p className="m-0 mb-10 max-w-[600px] text-[15px] text-white/58 sm:text-base">
        Начните с готового варианта или настройте всё с нуля. Цена пересчитывается автоматически.
      </p>

      {isLoading ? (
        <div className="text-white/45">Загружаем варианты…</div>
      ) : (
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
          {/* ЛЕВАЯ КОЛОНКА — шаги */}
          <div className="min-w-0 flex-1">
            {/* Пресеты */}
            <section className="mb-11">
              <div className="mb-1.5 text-[15px] font-bold">Готовые варианты</div>
              <div className="mb-5 text-[13px] text-white/50">
                Нажмите «Применить» под книгой — параметры заполнятся, дальше можно менять.
              </div>
              <div className="scrollx flex gap-8 overflow-x-auto px-1 pb-5">
                {PRESETS.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-none flex-col items-center gap-3 rounded-2xl border p-3.5 transition-colors"
                    style={{
                      borderColor: applied === p.id ? 'rgba(228,180,92,.5)' : 'rgba(255,255,255,.08)',
                      background: applied === p.id ? 'rgba(228,180,92,.06)' : 'transparent',
                    }}
                  >
                    <Book title={p.name} subtitle={p.subtitle} pw={130} ph={93} pages={blankPages(p.id)} />
                    <button
                      type="button"
                      onClick={() => applyPreset(p)}
                      className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
                        applied === p.id
                          ? 'bg-gold/15 text-gold'
                          : 'border border-white/15 text-white/80 hover:border-gold hover:text-gold'
                      }`}
                    >
                      {applied === p.id ? '✓ Применён' : 'Применить настройки'}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Обложка */}
            <section className="mb-10">
              <div className="mb-4 text-[15px] font-bold">1 · Обложка</div>
              <div className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:gap-3.5">
                {coverVariants.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setApplied(null)
                      setCover((prev) => (prev === c.id ? null : c.id))
                    }}
                    className="overflow-hidden rounded-2xl border-2 text-left transition-colors"
                    style={{ borderColor: cover === c.id ? '#E4B45C' : 'rgba(255,255,255,.1)' }}
                  >
                    <div className="relative h-[110px]">
                      <Photo src={c.imageUrl} alt={c.label} placeholder={c.label} />
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-surface-2 px-3 py-2.5">
                      <span className="truncate text-[13px] font-semibold">{c.label}</span>
                      <span className="flex-none text-[12px] text-white/50">
                        {c.priceMod > 0 ? `+${formatPrice(c.priceMod)}` : '—'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Вид фотосессии */}
            <section className="mb-10">
              <div className="mb-1.5 text-[15px] font-bold">2 · Вид фотосессии</div>
              <div className="mb-4 text-[13px] text-white/50">
                Можно выбрать несколько — стоимость суммируется.
              </div>
              <div className="grid gap-3 min-[520px]:grid-cols-2">
                {shootTypes.map((s) => {
                  const on = shoots.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleShoot(s.id)}
                      className="rounded-2xl border-2 p-4 text-left transition-colors"
                      style={{
                        borderColor: on ? '#E4B45C' : 'rgba(255,255,255,.1)',
                        background: on ? 'rgba(228,180,92,.06)' : 'transparent',
                      }}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="text-[15px] font-bold">{s.label}</span>
                        <span
                          className="flex h-5 w-5 flex-none items-center justify-center rounded-md border-2 text-[12px] font-extrabold text-on-gold"
                          style={{
                            borderColor: on ? '#E4B45C' : 'rgba(255,255,255,.25)',
                            background: on ? '#E4B45C' : 'transparent',
                          }}
                        >
                          {on ? '✓' : ''}
                        </span>
                      </div>
                      <div className="mb-2 text-[12px] leading-relaxed text-white/55">{s.description}</div>
                      <div className="text-[13px] font-semibold text-gold">{formatPrice(s.price)}</div>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Развороты */}
            <section>
              <div className="mb-4 flex items-baseline justify-between">
                <span className="text-[15px] font-bold">3 · Количество разворотов</span>
                <span className="font-display text-[22px] leading-none font-bold text-gold">{spreads}</span>
              </div>
              <input
                type="range"
                min={MIN_SPREADS}
                max={MAX_SPREADS}
                step={1}
                value={spreads}
                onChange={(e) => {
                  setApplied(null)
                  setSpreads(Number(e.target.value))
                }}
                className="w-full"
                aria-label="Количество разворотов"
              />
              <div className="mt-2 flex justify-between text-[11px] text-white/40">
                <span>{MIN_SPREADS}</span>
                <span>{MAX_SPREADS} разворотов</span>
              </div>
            </section>
          </div>

          {/* ПРАВАЯ КОЛОНКА — сводка. С lg липкая, ниже — в потоке. */}
          <div className="w-full lg:sticky lg:top-[90px] lg:w-[360px] lg:flex-none">
            <div className="rounded-[22px] border border-white/[.09] bg-surface-2 p-5 sm:p-7">
              <div className="font-display mb-5 text-[20px] leading-none font-bold">Ваш альбом</div>

              <div className="flex flex-col gap-3 border-b border-white/[.09] pb-5">
                <Row
                  label={`Съёмка · ${selectedShoots.length ? selectedShoots.map((s) => s.label).join(', ') : '—'}`}
                  value={formatPrice(price.priceShoots)}
                />
                <Row
                  label={`Развороты · ${pluralSpreads(spreads)}`}
                  value={formatPrice(price.priceSpreads)}
                />
                <Row
                  label={`Обложка · ${selectedCover?.label ?? '—'}`}
                  value={formatPrice(price.priceCover)}
                />
              </div>

              <div className="flex items-baseline justify-between py-5">
                <span className="text-sm text-white/55">Итого</span>
                <span className="font-display text-[30px] leading-none font-extrabold text-gold">
                  {formatPrice(price.total)}
                </span>
              </div>

              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-sm font-bold">Предоплата</span>
                <span className="text-xs text-white/45">от 20%</span>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2">
                {PREPAY_PERCENTS.map((p) => {
                  const on = prepayKind === 'percent' && prepayPercent === p
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setPrepayKind('percent')
                        setPrepayPercent(p)
                      }}
                      className="rounded-xl border-2 py-2.5 text-center text-sm font-bold transition-colors"
                      style={{
                        borderColor: on ? '#E4B45C' : 'rgba(255,255,255,.1)',
                        background: on ? 'rgba(228,180,92,.08)' : 'transparent',
                        color: on ? '#E4B45C' : undefined,
                      }}
                    >
                      {p}%
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setPrepayKind('full')}
                  className="rounded-xl border-2 py-2.5 text-center text-sm font-bold transition-colors"
                  style={{
                    borderColor: prepayKind === 'full' ? '#E4B45C' : 'rgba(255,255,255,.1)',
                    background: prepayKind === 'full' ? 'rgba(228,180,92,.08)' : 'transparent',
                    color: prepayKind === 'full' ? '#E4B45C' : undefined,
                  }}
                >
                  Полная
                </button>
                <button
                  type="button"
                  onClick={() => setPrepayKind('custom')}
                  className="rounded-xl border-2 py-2.5 text-center text-[13px] font-bold transition-colors"
                  style={{
                    borderColor: prepayKind === 'custom' ? '#E4B45C' : 'rgba(255,255,255,.1)',
                    background: prepayKind === 'custom' ? 'rgba(228,180,92,.08)' : 'transparent',
                    color: prepayKind === 'custom' ? '#E4B45C' : undefined,
                  }}
                >
                  Своя сумма
                </button>
              </div>

              {prepayKind === 'custom' && (
                <div className="mb-3">
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={minDue}
                      max={price.total}
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder={`${minDue}`}
                      className={`${fieldClass} pr-8`}
                      aria-label="Своя сумма предоплаты"
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-white/40">
                      ₽
                    </span>
                  </div>
                  <div className={`mt-1.5 text-[12px] ${customValid ? 'text-white/45' : 'text-red-300'}`}>
                    От {formatPrice(minDue)} до {formatPrice(price.total)}
                  </div>
                </div>
              )}

              <div className="mb-5 flex items-baseline justify-between rounded-xl bg-white/[.03] px-4 py-3">
                <span className="text-sm text-white/55">Сейчас к оплате</span>
                <span className="font-display text-[18px] leading-none font-bold text-gold">
                  {formatPrice(due)}
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                <input value={fio} onChange={(e) => setFio(e.target.value)} placeholder="ФИО" autoComplete="name" className={fieldClass} />
                <input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Школа / адрес" autoComplete="off" className={fieldClass} />
                <PhoneField value={phone} onChange={setPhone} required />
              </div>

              <button
                type="button"
                onClick={() => setPayOpen(true)}
                disabled={!canSubmit}
                className="mt-5 w-full rounded-full bg-gold px-6 py-3.5 text-[15px] font-bold text-on-gold transition-colors hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                Оплатить {formatPrice(due)}
              </button>
              {shoots.length === 0 && (
                <div className="mt-2 text-center text-[12px] text-white/40">
                  Выберите хотя бы один вид съёмки
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {payOpen && (
        <Modal title="Оплата заказа" onClose={() => (submitting ? undefined : setPayOpen(false))}>
          <div className="flex flex-col gap-4">
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-300">
                {error}
              </div>
            )}
            <div className="text-sm text-white/60">
              К оплате сейчас:{' '}
              <span className="font-display text-lg font-bold text-gold">{formatPrice(due)}</span>
            </div>

            <div className="flex flex-col gap-2.5">
              {(
                [
                  { key: 'SBP', title: 'СБП (по QR-коду)', sub: 'Оплата через приложение банка' },
                  { key: 'BANK', title: 'Картой через банк', sub: 'Переход на страницу эквайринга' },
                ] as const
              ).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setPayMethod(m.key)}
                  className="flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors"
                  style={{ borderColor: payMethod === m.key ? '#E4B45C' : 'rgba(255,255,255,.1)' }}
                >
                  <span
                    className="h-[18px] w-[18px] flex-none rounded-full border-2"
                    style={{
                      borderColor: payMethod === m.key ? '#E4B45C' : 'rgba(255,255,255,.25)',
                      background: payMethod === m.key ? '#E4B45C' : 'transparent',
                    }}
                  />
                  <span>
                    <span className="block text-sm font-bold">{m.title}</span>
                    <span className="block text-xs text-white/55">{m.sub}</span>
                  </span>
                </button>
              ))}
            </div>

            <p className="m-0 text-[12px] leading-relaxed text-white/40">
              Приём онлайн-оплаты ещё подключается. Заказ будет оформлен и передан фотографу — он
              свяжется с вами для подтверждения и оплаты.
            </p>

            <button
              type="button"
              onClick={() => void submitOrder()}
              disabled={submitting}
              className="rounded-full bg-gold px-6 py-3.5 text-[15px] font-bold text-on-gold transition-colors hover:bg-gold-hover disabled:opacity-50"
            >
              {submitting
                ? 'Оформляем…'
                : payMethod === 'SBP'
                  ? 'Сформировать QR-код'
                  : 'Перейти к оплате'}
            </button>
          </div>
        </Modal>
      )}

      <Toast toast={toast} />
    </div>
  )
}

const fieldClass =
  'w-full rounded-xl border border-white/[.12] bg-field px-4 py-3 text-sm text-bone outline-none transition-colors placeholder:text-white/30 focus:border-gold'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="min-w-0 break-words text-white/55">{label}</span>
      <span className="flex-none font-semibold">{value}</span>
    </div>
  )
}
