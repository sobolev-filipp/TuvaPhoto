import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/Modal'
import { Toast, useToast } from '@/components/Toast'
import { adminApi, ApiError, type ApiAdminOrder, type OrderStatus } from '@/lib/api'
import { connectAdminSocket } from '@/lib/socket'
import { formatPrice, pluralSpreads } from '@/domain/pricing'
import { CategoriesTab } from './admin/CategoriesTab'

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Ожидает оплаты',
  PAID: 'Оплачен',
  REFUND_PENDING: 'Ожидание возврата',
  REFUNDED: 'Деньги возвращены',
  CANCELLED: 'Отменён',
}

const STATUS_CLASS: Record<OrderStatus, string> = {
  PENDING: 'border-gold/40 bg-gold/10 text-gold',
  PAID: 'border-green-400/40 bg-green-500/10 text-green-300',
  REFUND_PENDING: 'border-orange-400/40 bg-orange-500/10 text-orange-300',
  REFUNDED: 'border-white/20 bg-white/5 text-white/60',
  CANCELLED: 'border-red-400/40 bg-red-500/10 text-red-300',
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const payTypeLabel = (o: ApiAdminOrder) => {
  if (o.payType === 'FULL') return 'Полная оплата'
  return o.prepayPercent != null ? `Предоплата ${o.prepayPercent}%` : 'Предоплата (своя сумма)'
}

const payMethodLabel = (m: ApiAdminOrder['payMethod']) =>
  m === 'SBP' ? 'СБП' : m === 'BANK' ? 'Картой' : '—'

/** Строка «ключ — значение» в раскрытой карточке заказа. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-white/50">{label}</span>
      <span className="text-right font-medium text-bone">{value}</span>
    </div>
  )
}

const smallBtn =
  'cursor-pointer rounded-xl border border-white/15 px-4 py-2.5 text-[13px] font-semibold text-bone transition-colors hover:border-gold/50 hover:text-gold disabled:cursor-default disabled:opacity-50'

/**
 * Копирование в буфер с запасным путём: Clipboard API может быть недоступен
 * (не защищённый контекст, отказ в правах) — тогда пробуем старый execCommand.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

function OrderCard({ order, onCopied }: { order: ApiAdminOrder; onCopied: (msg: string) => void }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [refundInput, setRefundInput] = useState('')
  const [paidInput, setPaidInput] = useState('')
  const [payUrl, setPayUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'orders'] })
    void qc.invalidateQueries({ queryKey: ['admin', 'unread'] })
  }
  const onError = (e: unknown) =>
    setActionError(e instanceof ApiError ? e.message : 'Не удалось выполнить действие')

  const markRead = useMutation({ mutationFn: () => adminApi.markRead(order.id), onSuccess: refresh })
  const setPaid = useMutation({
    mutationFn: (amount: number) => adminApi.setPaid(order.id, amount),
    onSuccess: () => {
      setActionError(null)
      setPaidInput('')
      refresh()
    },
    onError,
  })
  const payLink = useMutation({
    mutationFn: () => adminApi.payLink(order.id),
    onSuccess: (data) => setPayUrl(`${window.location.origin}${data.path}`),
    onError,
  })
  const cancel = useMutation({
    mutationFn: (amount: number) => adminApi.cancel(order.id, amount),
    onSuccess: () => {
      setCancelOpen(false)
      setActionError(null)
      refresh()
    },
    onError,
  })
  const refunded = useMutation({
    mutationFn: () => adminApi.refunded(order.id),
    onSuccess: refresh,
    onError,
  })

  const isNew = order.readAt === null

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && isNew && !markRead.isPending) markRead.mutate()
  }

  const openCancel = () => {
    // По умолчанию предлагаем вернуть уже внесённую сумму.
    setRefundInput(String(order.amountPaid))
    setActionError(null)
    setCancelOpen(true)
  }

  const copyLink = async () => {
    if (!payUrl) return
    try {
      await navigator.clipboard.writeText(payUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard недоступен — ссылка всё равно показана, можно скопировать вручную */
    }
  }

  const copyPhone = async () => {
    if (await copyText(order.phone)) onCopied('Телефон скопирован')
    else onCopied('Не удалось скопировать')
  }

  const refundNum = Number(refundInput)
  const refundValid = Number.isInteger(refundNum) && refundNum >= 0 && refundNum <= order.total

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-surface-2 transition-colors ${
        isNew ? 'border-gold/50' : 'border-white/[.09]'
      }`}
    >
      <button
        type="button"
        onClick={toggle}
        className="flex w-full cursor-pointer items-center gap-3 p-4 text-left"
      >
        {isNew && (
          <span className="flex-none rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-on-gold">
            Новый
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-[15px] font-bold">№{order.number}</span>
            <span className="truncate text-sm text-white/70">{order.fio}</span>
          </div>
          <div className="mt-0.5 truncate text-[13px] text-white/45">
            {dateFmt.format(new Date(order.createdAt))} · {order.school}
          </div>
        </div>
        <span
          className={`flex-none rounded-full border px-2.5 py-1 text-[12px] font-semibold ${STATUS_CLASS[order.status]}`}
        >
          {STATUS_LABEL[order.status]}
        </span>
        <span className="flex-none font-display text-[15px] font-bold text-gold">
          {formatPrice(order.total)}
        </span>
      </button>

      {open && (
        <div className="border-t border-white/[.07] px-4 pt-3 pb-4">
          {/* Телефон — по клику копируется (удобно набирать/писать клиенту). */}
          <div className="flex justify-between gap-4 py-1.5 text-sm">
            <span className="text-white/50">Телефон</span>
            <button
              type="button"
              onClick={copyPhone}
              title="Нажмите, чтобы скопировать"
              className="group flex cursor-pointer items-center gap-1.5 text-right font-medium text-bone hover:text-gold"
            >
              {order.phone}
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="flex-none text-white/35 group-hover:text-gold"
                aria-hidden="true"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>
          <Row label="Категория" value={order.category?.name ?? '—'} />
          <Row label="Виды съёмки" value={order.shootTypes.map((s) => s.label).join(', ') || '—'} />
          <Row label="Обложка" value={order.coverVariant?.label ?? '—'} />
          <Row label="Развороты" value={pluralSpreads(order.spreadsCount)} />
          <div className="my-2 h-px bg-white/[.07]" />
          <Row label="Съёмки" value={formatPrice(order.priceShoots)} />
          <Row label="Развороты" value={formatPrice(order.priceSpreads)} />
          <Row label="Обложка" value={formatPrice(order.priceCover)} />
          <Row label="Итого" value={formatPrice(order.total)} />
          <Row
            label="Предоплата (при заказе)"
            value={`${formatPrice(order.amountDue)} · ${payTypeLabel(order)}`}
          />
          <Row label="Способ оплаты" value={payMethodLabel(order.payMethod)} />
          <div className="my-2 h-px bg-white/[.07]" />
          <Row
            label="Внесено заказчиком"
            value={`${formatPrice(order.amountPaid)} из ${formatPrice(order.total)}`}
          />
          {order.status === 'REFUND_PENDING' && order.refundAmount != null && (
            <Row label="К возврату" value={formatPrice(order.refundAmount)} />
          )}

          {/* Действия зависят от статуса */}
          <div className="mt-4 flex flex-col gap-3">
            {actionError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
                {actionError}
              </div>
            )}

            {order.status === 'PENDING' && (
              <>
                <div>
                  <div className="mb-1.5 text-[12px] font-semibold tracking-wide text-white/45 uppercase">
                    Внесённая сумма
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      max={order.total}
                      value={paidInput}
                      onChange={(e) => setPaidInput(e.target.value)}
                      placeholder={String(order.amountPaid)}
                      className="w-full rounded-xl border border-white/[.12] bg-field px-3 py-2.5 text-sm text-bone outline-none focus:border-gold"
                    />
                    <button
                      type="button"
                      disabled={setPaid.isPending || paidInput === ''}
                      onClick={() => setPaid.mutate(Number(paidInput))}
                      className={smallBtn}
                    >
                      Сохранить
                    </button>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    disabled={payLink.isPending}
                    onClick={() => payLink.mutate()}
                    className={smallBtn}
                  >
                    {order.payToken || payUrl ? 'Показать ссылку на доплату' : 'Ссылка на доплату'}
                  </button>
                  {payUrl && (
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/[.12] bg-white/[.03] px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-[12px] text-white/70">{payUrl}</span>
                      <button
                        type="button"
                        onClick={() => void copyLink()}
                        className="flex-none cursor-pointer text-[12px] font-semibold text-gold"
                      >
                        {copied ? 'Скопировано' : 'Копировать'}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {(order.status === 'PENDING' || order.status === 'PAID') && (
              <button
                type="button"
                onClick={openCancel}
                className="cursor-pointer rounded-xl border border-red-400/30 bg-red-500/[.06] px-4 py-2.5 text-[13px] font-semibold text-red-300 transition-colors hover:border-red-400/60 hover:bg-red-500/15"
              >
                Отменить заказ
              </button>
            )}

            {order.status === 'REFUND_PENDING' && (
              <button
                type="button"
                disabled={refunded.isPending}
                onClick={() => refunded.mutate()}
                className="cursor-pointer rounded-xl border border-green-400/40 bg-green-500/10 px-4 py-2.5 text-[13px] font-semibold text-green-300 transition-colors hover:bg-green-500/20 disabled:opacity-50"
              >
                Деньги возвращены
              </button>
            )}

            {order.status === 'REFUNDED' && (
              <div className="text-[13px] text-white/45">Заказ отменён, средства возвращены.</div>
            )}
          </div>
        </div>
      )}

      {cancelOpen && (
        <Modal title={`Отмена заказа №${order.number}`} onClose={() => (cancel.isPending ? undefined : setCancelOpen(false))}>
          <div className="flex flex-col gap-4">
            <p className="m-0 text-sm text-white/60">
              Заказ перейдёт в «Ожидание возврата». Укажите сумму к возврату заказчику — по
              умолчанию это уже внесённая сумма.
            </p>
            {actionError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
                {actionError}
              </div>
            )}
            <div>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={order.total}
                  value={refundInput}
                  onChange={(e) => setRefundInput(e.target.value)}
                  className="w-full rounded-xl border border-white/[.12] bg-field px-3 py-3 pr-8 text-sm text-bone outline-none focus:border-gold"
                  aria-label="Сумма к возврату"
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-white/40">
                  ₽
                </span>
              </div>
              <div className={`mt-1.5 text-[12px] ${refundValid ? 'text-white/45' : 'text-red-300'}`}>
                От {formatPrice(0)} до {formatPrice(order.total)}
              </div>
            </div>
            <button
              type="button"
              disabled={!refundValid || cancel.isPending}
              onClick={() => cancel.mutate(refundNum)}
              className="rounded-full bg-gold px-6 py-3 text-[15px] font-bold text-on-gold transition-colors hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {cancel.isPending ? 'Отменяем…' : 'Отменить и оформить возврат'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function OrdersTab() {
  const qc = useQueryClient()
  const { toast, show } = useToast()

  const orders = useQuery({ queryKey: ['admin', 'orders'], queryFn: adminApi.orders })
  const unread = useQuery({
    queryKey: ['admin', 'unread'],
    queryFn: adminApi.unreadCount,
    // Поллинг — страховка на случай, если сокет отвалился.
    refetchInterval: 30_000,
  })

  const markAll = useMutation({
    mutationFn: () => adminApi.markAllRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'orders'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'unread'] })
    },
  })

  const unreadCount = unread.data?.count ?? 0

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="font-display m-0 text-[22px] font-extrabold">Заказы</h2>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="cursor-pointer rounded-full border border-white/15 px-4 py-2 text-[13px] font-semibold text-white/70 transition-colors hover:border-gold/50 hover:text-gold disabled:opacity-50"
          >
            Прочитать все
          </button>
        )}
      </div>

      {orders.isLoading && <p className="text-white/50">Загружаем заказы…</p>}
      {orders.isError && <p className="text-red-300">Не удалось загрузить заказы.</p>}
      {orders.data?.length === 0 && <p className="text-white/50">Заказов пока нет.</p>}

      <div className="flex flex-col gap-3">
        {orders.data?.map((o) => (
          <OrderCard key={o.id} order={o} onCopied={show} />
        ))}
      </div>

      <Toast toast={toast} />
    </div>
  )
}

type TabKey = 'orders' | 'categories'

export function AdminPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabKey>('orders')

  const unread = useQuery({ queryKey: ['admin', 'unread'], queryFn: adminApi.unreadCount })
  const unreadCount = unread.data?.count ?? 0

  // Realtime: новый заказ → обновляем список и счётчик. Сокет живёт, пока
  // открыта админка; при уходе со страницы — отключаемся.
  useEffect(() => {
    const socket = connectAdminSocket()
    const invalidate = () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'orders'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'unread'] })
    }
    // created — новый заказ (бейдж), updated — оплата/отмена/возврат (список).
    socket.on('order.created', invalidate)
    socket.on('order.updated', invalidate)
    return () => {
      socket.disconnect()
    }
  }, [qc])

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'orders', label: 'Заказы', badge: unreadCount },
    { key: 'categories', label: 'Категории' },
  ]

  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-[50px] pb-[100px] sm:px-6 md:px-10 md:pt-[60px]">
      <div className="mb-6 font-mono text-[12px] font-bold tracking-[.14em] text-gold uppercase sm:text-[13px]">
        Админ-панель
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        {/* Меню-вкладки: столбец на десктопе, горизонтальный ряд на мобиле. */}
        <nav className="flex gap-2 overflow-x-auto md:w-[220px] md:flex-none md:flex-col">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex flex-none items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-[15px] font-semibold transition-colors ${
                tab === t.key
                  ? 'border-gold/50 bg-gold/10 text-gold'
                  : 'border-white/[.09] bg-surface-2 text-bone hover:border-gold/30'
              }`}
            >
              {t.label}
              {t.badge ? (
                <span className="flex-none rounded-full bg-gold px-2 py-0.5 text-[12px] font-bold text-on-gold">
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          {tab === 'orders' && <OrdersTab />}
          {tab === 'categories' && <CategoriesTab />}
        </div>
      </div>
    </div>
  )
}
