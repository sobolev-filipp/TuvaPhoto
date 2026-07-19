import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, payApi, type ApiPayOrder } from '@/lib/api'
import { formatPrice } from '@/domain/pricing'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-white/50">{label}</span>
      <span className="text-right font-medium text-bone">{value}</span>
    </div>
  )
}

const methodLabel = (m: ApiPayOrder['payMethod']) =>
  m === 'SBP' ? 'СБП (по QR-коду)' : m === 'BANK' ? 'Картой через банк' : 'Уточняется'

export function PayPage() {
  const { token = '' } = useParams()
  const qc = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['pay', token],
    queryFn: () => payApi.get(token),
    retry: false,
  })

  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)

  // По умолчанию предлагаем внести весь остаток.
  useEffect(() => {
    if (data && amount === '') setAmount(String(data.remaining))
  }, [data, amount])

  const pay = useMutation({
    mutationFn: (value: number) => payApi.pay(token, value),
    onSuccess: () => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['pay', token] })
      setAmount('')
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Не удалось провести оплату'),
  })

  const shell = (children: React.ReactNode) => (
    <div className="animate-fade-up mx-auto max-w-[560px] px-4 pt-[60px] pb-[100px] sm:px-6 md:pt-[80px]">
      {children}
    </div>
  )

  if (isLoading) return shell(<p className="text-white/50">Загружаем заказ…</p>)
  if (isError || !data)
    return shell(
      <div className="rounded-2xl border border-white/[.09] bg-surface-2 p-6 text-center">
        <div className="font-display mb-2 text-[22px] font-extrabold">Ссылка недействительна</div>
        <p className="m-0 text-white/55">Проверьте ссылку у фотографа — возможно, она устарела.</p>
      </div>,
    )

  const num = Number(amount)
  const valid = Number.isInteger(num) && num >= 1 && num <= data.remaining
  const done = data.status !== 'PENDING' || data.remaining === 0

  return shell(
    <>
      <div className="mb-3.5 font-mono text-[12px] font-bold tracking-[.14em] text-gold uppercase">
        Оплата заказа №{data.number}
      </div>
      <h1 className="font-display m-0 mb-6 text-[26px] leading-tight font-extrabold sm:text-[32px]">
        {done ? 'Заказ оплачен' : 'Внесение оплаты'}
      </h1>

      <div className="rounded-2xl border border-white/[.09] bg-surface-2 p-5 sm:p-6">
        <Row label="Заказчик" value={data.fio} />
        <Row label="Школа / адрес" value={data.school} />
        <Row label="Телефон" value={data.phone} />
        {data.category && <Row label="Категория" value={data.category} />}
        <Row label="Виды съёмки" value={data.shootTypes.join(', ') || '—'} />
        {data.cover && <Row label="Обложка" value={data.cover} />}
        <Row label="Способ оплаты" value={methodLabel(data.payMethod)} />
        <div className="my-2 h-px bg-white/[.07]" />
        <Row label="Итого по заказу" value={formatPrice(data.total)} />
        <Row label="Уже внесено" value={formatPrice(data.amountPaid)} />
        <div className="flex justify-between gap-4 py-1.5 text-sm">
          <span className="text-white/50">Осталось</span>
          <span className="font-display text-[17px] font-bold text-gold">
            {formatPrice(data.remaining)}
          </span>
        </div>
      </div>

      {done ? (
        <div className="mt-5 rounded-2xl border border-green-400/40 bg-green-500/10 p-5 text-center text-green-300">
          Оплата получена полностью. Спасибо! Фотограф свяжется с вами.
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-white/[.09] bg-surface-2 p-5 sm:p-6">
          <div className="mb-2 text-sm font-bold">Сколько внести</div>
          {error && (
            <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
              {error}
            </div>
          )}
          <div className="relative">
            <input
              type="number"
              min={1}
              max={data.remaining}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-white/[.12] bg-field px-4 py-3 pr-8 text-sm text-bone outline-none focus:border-gold"
              aria-label="Сумма к оплате"
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-white/40">
              ₽
            </span>
          </div>
          <div className={`mt-1.5 text-[12px] ${valid || amount === '' ? 'text-white/45' : 'text-red-300'}`}>
            От {formatPrice(1)} до {formatPrice(data.remaining)}
          </div>

          <button
            type="button"
            disabled={!valid || pay.isPending}
            onClick={() => pay.mutate(num)}
            className="mt-4 w-full rounded-full bg-gold px-6 py-3.5 text-[15px] font-bold text-on-gold transition-colors hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pay.isPending ? 'Проводим оплату…' : `Оплатить ${valid ? formatPrice(num) : ''}`.trim()}
          </button>
          <p className="m-0 mt-3 text-[12px] leading-relaxed text-white/40">
            Приём онлайн-оплаты ещё подключается — это демонстрационная оплата. Реальные платежи
            (СБП/эквайринг) появятся позже.
          </p>
        </div>
      )}
    </>,
  )
}
