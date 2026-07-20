import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImageUpload, type ImageRef } from '@/components/admin/ImageUpload'
import {
  adminApi,
  ApiError,
  type AdminShare,
  type AlbumOrientation,
  type SharePaidOrder,
  type SpreadLayout,
} from '@/lib/api'
import { formatPrice } from '@/domain/pricing'
import { ConfirmDialog } from '@/components/ConfirmDialog'

const fieldClass =
  'w-full rounded-xl border border-white/[.12] bg-field px-3 py-2.5 text-sm text-bone outline-none transition-colors placeholder:text-white/30 focus:border-gold'

interface SpreadState {
  key: string
  layout: SpreadLayout
  image: ImageRef | null
  rightImage: ImageRef | null
}

const newSpread = (): SpreadState => ({
  key: Math.random().toString(36).slice(2),
  layout: 'SINGLE',
  image: null,
  rightImage: null,
})

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
/** Значение <input type="date"> (YYYY-MM-DD) → ISO на конец этого дня. */
const dayEndIso = (d: string) => new Date(`${d}T23:59:59`).toISOString()

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Выбор оплаченного заказа: поиск по №/ФИО/телефону/email + диапазон номеров + карточки. */
function OrderPicker({
  orders,
  selectedId,
  onSelect,
}: {
  orders: SharePaidOrder[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [fromNum, setFromNum] = useState('')
  const [toNum, setToNum] = useState('')

  const selected = orders.find((o) => o.id === selectedId) ?? null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const from = fromNum ? Number(fromNum) : null
    const to = toNum ? Number(toNum) : null
    return orders.filter((o) => {
      const matchesText =
        !q ||
        String(o.number).includes(q) ||
        o.fio.toLowerCase().includes(q) ||
        o.phone.toLowerCase().includes(q) ||
        o.school.toLowerCase().includes(q) ||
        (o.email?.toLowerCase().includes(q) ?? false)
      const matchesRange = (from == null || o.number >= from) && (to == null || o.number <= to)
      return matchesText && matchesRange
    })
  }, [orders, search, fromNum, toNum])

  // Заказ выбран — показываем его карточкой с возможностью сменить.
  if (selected) {
    return (
      <div className="rounded-xl border border-gold/40 bg-gold/[.06] px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-bone">
              №{selected.number} · {selected.fio}
            </div>
            <div className="mt-0.5 text-[12px] text-white/55">
              {selected.school} · {selected.phone}
              {selected.email && ` · ${selected.email}`} · {formatPrice(selected.total)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelect('')}
            className="flex-none cursor-pointer rounded-lg border border-white/15 px-3 py-1.5 text-[12px] font-semibold text-bone hover:border-gold/50 hover:text-gold"
          >
            Изменить
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск: № заказа, ФИО, телефон, email…"
        className={fieldClass}
      />
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-white/45">Номера от</span>
        <input
          type="number"
          value={fromNum}
          onChange={(e) => setFromNum(e.target.value)}
          placeholder="1"
          className="w-24 rounded-xl border border-white/[.12] bg-field px-3 py-2 text-sm text-bone outline-none focus:border-gold"
        />
        <span className="text-[12px] text-white/45">до</span>
        <input
          type="number"
          value={toNum}
          onChange={(e) => setToNum(e.target.value)}
          placeholder="100"
          className="w-24 rounded-xl border border-white/[.12] bg-field px-3 py-2 text-sm text-bone outline-none focus:border-gold"
        />
      </div>

      {orders.length === 0 ? (
        <div className="text-[12px] text-white/40">Оплаченных заказов пока нет.</div>
      ) : (
        <div className="flex max-h-[280px] flex-col gap-2 overflow-y-auto pr-1">
          {filtered.length === 0 && (
            <div className="text-[12px] text-white/40">Ничего не найдено по фильтру.</div>
          )}
          {filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onSelect(o.id)}
              className="cursor-pointer rounded-xl border border-white/[.1] bg-surface px-3 py-2.5 text-left transition-colors hover:border-gold/50"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-bone">
                  №{o.number} · {o.fio}
                </span>
                <span className="flex-none text-[12px] font-semibold text-gold">
                  {formatPrice(o.total)}
                </span>
              </div>
              <div className="mt-0.5 truncate text-[12px] text-white/50">
                {o.school} · {o.phone}
                {o.email && ` · ${o.email}`}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Форма создания демо-ссылки. */
function CreateShareForm({ onCreated }: { onCreated: () => void }) {
  const qc = useQueryClient()
  const paidOrders = useQuery({ queryKey: ['admin', 'share-orders'], queryFn: adminApi.sharePaidOrders })

  const [orderId, setOrderId] = useState('')
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [orientation, setOrientation] = useState<AlbumOrientation>('LANDSCAPE')
  const [cover, setCover] = useState<ImageRef | null>(null)
  const [backCover, setBackCover] = useState<ImageRef | null>(null)
  const [spreads, setSpreads] = useState<SpreadState[]>([newSpread()])
  const [expiresAt, setExpiresAt] = useState('')
  const [diskUrl, setDiskUrl] = useState('')
  const [downloadUntil, setDownloadUntil] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [createdPath, setCreatedPath] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const patchSpread = (key: string, patch: Partial<SpreadState>) =>
    setSpreads((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)))

  const save = useMutation({
    mutationFn: async () => {
      const { path } = await adminApi.createShare({
        orderId,
        title: title.trim(),
        subtitle: subtitle.trim(),
        orientation,
        coverImageId: cover?.id ?? null,
        backCoverImageId: backCover?.id ?? null,
        spreads: spreads.map((s) => ({
          layout: s.layout,
          imageId: s.image?.id ?? null,
          rightImageId: s.layout === 'DOUBLE' ? (s.rightImage?.id ?? null) : null,
        })),
        expiresAt: dayEndIso(expiresAt),
        diskUrl: diskUrl.trim() || null,
        downloadUntil: downloadUntil ? dayEndIso(downloadUntil) : null,
      })
      return path
    },
    onSuccess: (path) => {
      setError(null)
      setCreatedPath(path)
      void qc.invalidateQueries({ queryKey: ['admin', 'shares'] })
      onCreated()
    },
    onError: (e: unknown) =>
      setError(e instanceof ApiError ? e.message : 'Не удалось создать демо-ссылку'),
  })

  const canSave =
    orderId !== '' && title.trim().length >= 2 && expiresAt !== '' && !save.isPending

  // Успешно создано — показываем ссылку и предлагаем создать ещё.
  if (createdPath) {
    const url = `${window.location.origin}${createdPath}`
    return (
      <div className="rounded-2xl border border-gold/40 bg-gold/[.06] p-5">
        <div className="mb-2 font-display text-[16px] font-bold text-gold">Демо-ссылка создана</div>
        <p className="mb-3 text-[13px] text-white/60">
          Скопируйте и отправьте клиенту. Ссылка также появилась в истории его заказа.
        </p>
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/[.12] bg-white/[.03] px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-[13px] text-white/80">{url}</span>
          <button
            type="button"
            onClick={async () => {
              if (await copyText(url)) {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }
            }}
            className="flex-none cursor-pointer text-[13px] font-semibold text-gold"
          >
            {copied ? 'Скопировано' : 'Копировать'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreatedPath(null)
            setOrderId('')
            setTitle('')
            setSubtitle('')
            setCover(null)
            setBackCover(null)
            setSpreads([newSpread()])
            setExpiresAt('')
            setDiskUrl('')
            setDownloadUntil('')
          }}
          className="cursor-pointer rounded-full border border-white/15 px-4 py-2 text-[13px] font-semibold text-bone hover:border-gold/50 hover:text-gold"
        >
          Создать ещё
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/[.09] bg-surface-2 p-5">
      <div className="mb-4 font-display text-[16px] font-bold">Новая демо-ссылка</div>
      <div className="flex flex-col gap-4">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-white/70">Оплаченный заказ</span>
          <OrderPicker
            orders={paidOrders.data ?? []}
            selectedId={orderId}
            onSelect={setOrderId}
          />
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-white/70">Заголовок</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Выпускной 2026 — 4«А»" className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-white/70">Подзаголовок</span>
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={fieldClass} />
        </label>

        <div>
          <div className="mb-2 text-[13px] font-semibold text-white/70">Ориентация</div>
          <div className="flex gap-2">
            {(
              [
                { v: 'LANDSCAPE', label: 'Альбомная' },
                { v: 'PORTRAIT', label: 'Книжная' },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setOrientation(o.v)}
                className="cursor-pointer rounded-xl border-2 px-4 py-2.5 text-[13px] font-semibold transition-colors"
                style={{
                  borderColor: orientation === o.v ? '#E4B45C' : 'rgba(255,255,255,.12)',
                  background: orientation === o.v ? 'rgba(228,180,92,.1)' : 'transparent',
                  color: orientation === o.v ? '#E4B45C' : undefined,
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          <ImageUpload label="Обложка" value={cover} onChange={setCover} />
          <ImageUpload label="Задняя обложка" value={backCover} onChange={setBackCover} />
        </div>

        {/* Развороты */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-white/70">Развороты</span>
            <button
              type="button"
              onClick={() => setSpreads((prev) => [...prev, newSpread()])}
              className="cursor-pointer rounded-full border border-white/15 px-3 py-1.5 text-[13px] font-semibold text-bone hover:border-gold/50 hover:text-gold"
            >
              + Разворот
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {spreads.map((s, i) => (
              <div key={s.key} className="rounded-2xl border border-white/[.09] bg-surface p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-[13px] font-bold text-white/70">Разворот {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => setSpreads((prev) => prev.filter((x) => x.key !== s.key))}
                    className="cursor-pointer rounded-lg border border-red-400/30 px-2.5 py-1 text-[12px] font-semibold text-red-300 hover:border-red-400/60"
                  >
                    Удалить
                  </button>
                </div>
                <div className="mb-3 flex gap-2">
                  {(
                    [
                      { v: 'SINGLE', label: '1 фото' },
                      { v: 'DOUBLE', label: '2 фото' },
                    ] as const
                  ).map((l) => (
                    <button
                      key={l.v}
                      type="button"
                      onClick={() => patchSpread(s.key, { layout: l.v })}
                      className="cursor-pointer rounded-lg border-2 px-3 py-1.5 text-[12px] font-semibold transition-colors"
                      style={{
                        borderColor: s.layout === l.v ? '#E4B45C' : 'rgba(255,255,255,.12)',
                        background: s.layout === l.v ? 'rgba(228,180,92,.1)' : 'transparent',
                        color: s.layout === l.v ? '#E4B45C' : undefined,
                      }}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-6">
                  <ImageUpload
                    label={s.layout === 'DOUBLE' ? 'Левое фото' : 'Фото'}
                    value={s.image}
                    onChange={(img) => patchSpread(s.key, { image: img })}
                  />
                  {s.layout === 'DOUBLE' && (
                    <ImageUpload
                      label="Правое фото"
                      value={s.rightImage}
                      onChange={(img) => patchSpread(s.key, { rightImage: img })}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-white/70">Демо доступно до</span>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-white/70">
              Скачать с диска до <span className="font-normal text-white/40">(необяз.)</span>
            </span>
            <input type="date" value={downloadUntil} onChange={(e) => setDownloadUntil(e.target.value)} className={fieldClass} />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-white/70">
            Ссылка на диск с фото <span className="font-normal text-white/40">(необяз.)</span>
          </span>
          <input value={diskUrl} onChange={(e) => setDiskUrl(e.target.value)} placeholder="https://disk.yandex.ru/…" className={fieldClass} />
        </label>

        <button
          type="button"
          disabled={!canSave}
          onClick={() => save.mutate()}
          className="rounded-full bg-gold px-6 py-3 text-[15px] font-bold text-on-gold transition-colors hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {save.isPending ? 'Создаём…' : 'Создать демо-ссылку'}
        </button>
      </div>
    </div>
  )
}

/** Карточка существующей демо-ссылки. */
function ShareCard({ share, onDeleted }: { share: AdminShare; onDeleted: () => void }) {
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [delError, setDelError] = useState<string | null>(null)
  const del = useMutation({
    mutationFn: () => adminApi.deleteShare(share.id),
    onSuccess: () => {
      setConfirming(false)
      onDeleted()
    },
    onError: (e: unknown) => setDelError(e instanceof ApiError ? e.message : 'Не удалось удалить'),
  })
  const url = `${window.location.origin}${share.path}`

  return (
    <div className="rounded-2xl border border-white/[.09] bg-surface-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-[15px] font-bold">{share.title}</span>
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-white/55">
              заказ №{share.orderNumber}
            </span>
            {share.expired ? (
              <span className="rounded-full border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-300">
                Истекла
              </span>
            ) : (
              <span className="rounded-full border border-green-400/40 bg-green-500/10 px-2 py-0.5 text-[11px] font-semibold text-green-300">
                Активна
              </span>
            )}
          </div>
          <div className="mt-1 text-[13px] text-white/50">
            {share.orderFio} · {share.spreadsCount} разв. · до{' '}
            {dateFmt.format(new Date(share.expiresAt))}
            {share.contentDeleted && ' · демо вычищено'}
          </div>
          {share.diskUrl && (
            <div className="mt-1 truncate text-[12px] text-white/45">
              Диск: {share.diskUrl}
              {share.downloadUntil && ` (до ${dateFmt.format(new Date(share.downloadUntil))})`}
            </div>
          )}
          {!share.expired && (
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/[.12] bg-white/[.03] px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[12px] text-white/70">{url}</span>
              <button
                type="button"
                onClick={async () => {
                  if (await copyText(url)) {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  }
                }}
                className="flex-none cursor-pointer text-[12px] font-semibold text-gold"
              >
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setDelError(null)
            setConfirming(true)
          }}
          className="flex-none cursor-pointer rounded-lg border border-red-400/30 px-3 py-1.5 text-[13px] font-semibold text-red-300 transition-colors hover:border-red-400/60"
        >
          Удалить
        </button>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Удалить демо-ссылку"
          message={`Удалить демо-ссылку «${share.title}»? Клиент больше не сможет открыть её.`}
          busy={del.isPending}
          error={delError}
          onConfirm={() => del.mutate()}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  )
}

export function ShareTab() {
  const qc = useQueryClient()
  const shares = useQuery({ queryKey: ['admin', 'shares'], queryFn: adminApi.shares })
  const [showForm, setShowForm] = useState(false)

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'shares'] })
    void qc.invalidateQueries({ queryKey: ['admin', 'share-orders'] })
  }

  const list = useMemo(() => shares.data ?? [], [shares.data])

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <h2 className="font-display m-0 text-[22px] font-extrabold">Готовые альбомы для клиента</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="cursor-pointer rounded-full bg-gold px-4 py-2 text-[13px] font-bold text-on-gold transition-colors hover:bg-gold-hover"
        >
          {showForm ? 'Скрыть форму' : '+ Создать'}
        </button>
      </div>
      <p className="mb-5 text-[13px] text-white/45">
        Демо-альбом по секретной ссылке для оплаченного заказа. По истечении срока просмотр
        закрывается, а фото демо удаляются из базы (ссылка остаётся в истории заказа).
      </p>

      {showForm && (
        <div className="mb-6">
          <CreateShareForm onCreated={invalidate} />
        </div>
      )}

      {shares.isLoading && <p className="text-white/50">Загружаем…</p>}
      {list.length === 0 && !shares.isLoading && (
        <p className="text-white/50">Демо-ссылок пока нет.</p>
      )}

      <div className="flex flex-col gap-3">
        {list.map((s) => (
          <ShareCard key={s.id} share={s} onDeleted={invalidate} />
        ))}
      </div>
    </div>
  )
}
