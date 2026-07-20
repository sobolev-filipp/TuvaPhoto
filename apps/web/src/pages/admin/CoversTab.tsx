import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi, ApiError, type AdminCover } from '@/lib/api'
import { formatPrice } from '@/domain/pricing'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { CoverEditor } from './CoverEditor'

export function CoversTab() {
  const qc = useQueryClient()
  const covers = useQuery({ queryKey: ['admin', 'covers'], queryFn: adminApi.covers })
  const categories = useQuery({ queryKey: ['admin', 'categories'], queryFn: adminApi.categories })

  const [editing, setEditing] = useState<AdminCover | 'new' | null>(null)

  const [items, setItems] = useState<AdminCover[]>([])
  useEffect(() => {
    if (covers.data) setItems(covers.data)
  }, [covers.data])

  const dragFrom = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const [confirming, setConfirming] = useState<AdminCover | null>(null)
  const [delError, setDelError] = useState<string | null>(null)

  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteCover(id),
    onSuccess: () => {
      setConfirming(null)
      void qc.invalidateQueries({ queryKey: ['admin', 'covers'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'categories'] })
    },
    onError: (e: unknown) =>
      setDelError(e instanceof ApiError ? e.message : 'Не удалось удалить обложку'),
  })

  const reorder = useMutation({
    mutationFn: (ids: string[]) => adminApi.reorderCovers(ids),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'covers'] }),
  })

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setItems(next)
    reorder.mutate(next.map((c) => c.id))
  }

  const catName = (id: string) => categories.data?.find((c) => c.id === id)?.name ?? '—'

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <h2 className="font-display m-0 text-[22px] font-extrabold">Обложки</h2>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="cursor-pointer rounded-full bg-gold px-4 py-2 text-[13px] font-bold text-on-gold transition-colors hover:bg-gold-hover"
        >
          + Добавить
        </button>
      </div>
      <p className="mb-5 text-[13px] text-white/45">
        Обложки выбираются в конструкторе и при создании альбома (по категории). Порядок карточек =
        порядок вывода. Перетаскивайте за значок ⠿ или двигайте стрелками.
      </p>

      {covers.isLoading && <p className="text-white/50">Загружаем обложки…</p>}
      {covers.isError && <p className="text-red-300">Не удалось загрузить обложки.</p>}
      {covers.data?.length === 0 && <p className="text-white/50">Обложек пока нет.</p>}

      <div className="flex flex-col gap-3">
        {items.map((c, i) => (
          <div
            key={c.id}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(i)
            }}
            onDrop={() => {
              if (dragFrom.current !== null) move(dragFrom.current, i)
              dragFrom.current = null
              setDragOver(null)
            }}
            className={`flex items-stretch overflow-hidden rounded-2xl border bg-surface-2 transition-colors ${
              dragOver === i ? 'border-gold/60' : 'border-white/[.09]'
            }`}
          >
            <div
              draggable
              onDragStart={() => {
                dragFrom.current = i
              }}
              onDragEnd={() => {
                dragFrom.current = null
                setDragOver(null)
              }}
              className="flex flex-none cursor-grab items-center border-r border-white/[.07] px-2.5 text-lg text-white/35 transition-colors select-none hover:bg-white/[.04] hover:text-gold active:cursor-grabbing"
              title="Перетащите, чтобы изменить порядок"
              aria-hidden="true"
            >
              ⠿
            </div>

            <div className="flex flex-1 items-start gap-3 p-4">
              {/* Превью передней обложки */}
              <div className="h-16 w-16 flex-none overflow-hidden rounded-lg border border-white/[.09] bg-black/20">
                {c.imageUrl ? (
                  <img src={c.imageUrl} alt={c.label} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[11px] text-white/30">
                    нет фото
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-[16px] font-bold">{c.label}</span>
                  {!c.isActive && (
                    <span className="flex-none rounded-full border border-white/20 px-2 py-0.5 text-[11px] font-semibold text-white/50">
                      Выключена
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[13px] text-white/60">
                  Надбавка: {c.priceMod > 0 ? `+${formatPrice(c.priceMod)}` : 'без надбавки'}
                </div>
                <div className="mt-1 text-[12px] text-white/45">
                  Категории: {c.categoryIds.length ? c.categoryIds.map(catName).join(', ') : '—'}
                </div>
              </div>

              <div className="flex flex-none flex-col items-end gap-2">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, i - 1)}
                    disabled={i === 0}
                    aria-label="Выше"
                    className="cursor-pointer rounded-md border border-white/15 px-2 py-1 text-[13px] text-white/70 transition-colors hover:border-gold/50 hover:text-gold disabled:cursor-default disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, i + 1)}
                    disabled={i === items.length - 1}
                    aria-label="Ниже"
                    className="cursor-pointer rounded-md border border-white/15 px-2 py-1 text-[13px] text-white/70 transition-colors hover:border-gold/50 hover:text-gold disabled:cursor-default disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(c)}
                    className="cursor-pointer rounded-lg border border-white/15 px-3 py-1.5 text-[13px] font-semibold text-bone transition-colors hover:border-gold/50 hover:text-gold"
                  >
                    Изменить
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDelError(null)
                      setConfirming(c)
                    }}
                    className="cursor-pointer rounded-lg border border-red-400/30 px-3 py-1.5 text-[13px] font-semibold text-red-300 transition-colors hover:border-red-400/60"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <CoverEditor
          initial={editing === 'new' ? null : editing}
          categories={categories.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}

      {confirming && (
        <ConfirmDialog
          title="Удалить обложку"
          message={`Удалить обложку «${confirming.label}»? Это действие необратимо.`}
          busy={del.isPending}
          error={delError}
          onConfirm={() => del.mutate(confirming.id)}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  )
}
