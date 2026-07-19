import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/Modal'
import { adminApi, ApiError, type AdminCategory, type AdminCover } from '@/lib/api'
import { formatPrice } from '@/domain/pricing'

const fieldClass =
  'w-full rounded-xl border border-white/[.12] bg-field px-3 py-2.5 text-sm text-bone outline-none transition-colors placeholder:text-white/30 focus:border-gold'

/** Редактор категории (создание и правка) в модалке. */
function CategoryEditor({
  initial,
  covers,
  onClose,
}: {
  initial: AdminCategory | null
  covers: AdminCover[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState(initial?.name ?? '')
  const [allowCover, setAllowCover] = useState(initial?.allowCover ?? false)
  const [coverIds, setCoverIds] = useState<string[]>(initial?.coverVariantIds ?? [])
  const [error, setError] = useState<string | null>(null)

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['admin', 'categories'] })
  const onError = (e: unknown) =>
    setError(e instanceof ApiError ? e.message : 'Не удалось сохранить категорию')

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        allowCover,
        // Обложки шлём только когда их выбор разрешён.
        coverVariantIds: allowCover ? coverIds : [],
      }
      if (initial) await adminApi.updateCategory(initial.id, body)
      else await adminApi.createCategory(body)
    },
    onSuccess: () => {
      invalidate()
      onClose()
    },
    onError,
  })

  const toggleCover = (id: string) =>
    setCoverIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const nameValid = name.trim().length >= 2

  return (
    <Modal
      title={initial ? `Категория «${initial.name}»` : 'Новая категория'}
      onClose={() => (save.isPending ? undefined : onClose())}
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
            {error}
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-white/70">Название</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, Начальная школа"
            className={fieldClass}
          />
        </label>

        <button
          type="button"
          onClick={() => setAllowCover((v) => !v)}
          className="flex items-center gap-3 rounded-xl border border-white/[.12] px-3 py-3 text-left"
        >
          <span
            className="flex h-5 w-5 flex-none items-center justify-center rounded-md border-2 text-[12px] font-extrabold text-on-gold"
            style={{
              borderColor: allowCover ? '#E4B45C' : 'rgba(255,255,255,.25)',
              background: allowCover ? '#E4B45C' : 'transparent',
            }}
          >
            {allowCover ? '✓' : ''}
          </span>
          <span className="text-sm font-semibold">Разрешить выбор обложки</span>
        </button>

        {allowCover && (
          <div>
            <div className="mb-2 text-[13px] font-semibold text-white/70">
              Доступные обложки {coverIds.length > 0 && `· выбрано ${coverIds.length}`}
            </div>
            <div className="flex flex-wrap gap-2">
              {covers.map((c) => {
                const on = coverIds.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCover(c.id)}
                    className="cursor-pointer rounded-full border-2 px-3.5 py-2 text-[13px] font-semibold transition-colors"
                    style={{
                      borderColor: on ? '#E4B45C' : 'rgba(255,255,255,.12)',
                      background: on ? 'rgba(228,180,92,.1)' : 'transparent',
                      color: on ? '#E4B45C' : undefined,
                    }}
                  >
                    {c.label}
                    {c.priceMod > 0 && (
                      <span className="ml-1 text-[11px] opacity-70">+{formatPrice(c.priceMod)}</span>
                    )}
                  </button>
                )
              })}
            </div>
            {coverIds.length === 0 && (
              <div className="mt-2 text-[12px] text-white/40">
                Не выбрано ни одной обложки — в конструкторе шаг обложки для этой категории не покажется.
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          disabled={!nameValid || save.isPending}
          onClick={() => save.mutate()}
          className="rounded-full bg-gold px-6 py-3 text-[15px] font-bold text-on-gold transition-colors hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {save.isPending ? 'Сохраняем…' : initial ? 'Сохранить' : 'Создать'}
        </button>
      </div>
    </Modal>
  )
}

export function CategoriesTab() {
  const qc = useQueryClient()
  const categories = useQuery({ queryKey: ['admin', 'categories'], queryFn: adminApi.categories })
  const covers = useQuery({ queryKey: ['admin', 'covers'], queryFn: adminApi.covers })

  // null — редактор закрыт; 'new' — создание; объект — правка.
  const [editing, setEditing] = useState<AdminCategory | 'new' | null>(null)

  // Локальная копия для мгновенного отклика при перетаскивании; синхронизируем
  // с сервером при каждой загрузке списка.
  const [items, setItems] = useState<AdminCategory[]>([])
  useEffect(() => {
    if (categories.data) setItems(categories.data)
  }, [categories.data])

  const dragFrom = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteCategory(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'categories'] }),
  })

  const reorder = useMutation({
    mutationFn: (ids: string[]) => adminApi.reorderCategories(ids),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'categories'] }),
  })

  // Переставить элемент с позиции from на to и отправить новый порядок на сервер.
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setItems(next)
    reorder.mutate(next.map((c) => c.id))
  }

  const coverLabel = (ids: string[]) => {
    const labels = (covers.data ?? []).filter((c) => ids.includes(c.id)).map((c) => c.label)
    return labels.length ? labels.join(', ') : '—'
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <h2 className="font-display m-0 text-[22px] font-extrabold">Категории</h2>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="cursor-pointer rounded-full bg-gold px-4 py-2 text-[13px] font-bold text-on-gold transition-colors hover:bg-gold-hover"
        >
          + Добавить
        </button>
      </div>
      <p className="mb-5 text-[13px] text-white/45">
        Порядок карточек = порядок вывода категорий. Перетаскивайте за значок ⠿ или двигайте стрелками.
      </p>

      {categories.isLoading && <p className="text-white/50">Загружаем категории…</p>}
      {categories.isError && <p className="text-red-300">Не удалось загрузить категории.</p>}

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
            {/* Ручка перетаскивания — на всю высоту карточки */}
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
              <div className="min-w-0 flex-1">
                <div className="font-display text-[16px] font-bold">{c.name}</div>
                <div className="mt-2 flex flex-col gap-1 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-white/50">Выбор обложки</span>
                    <span className="font-medium">{c.allowCover ? 'Разрешён' : 'Нет'}</span>
                  </div>
                  {c.allowCover && (
                    <div className="flex justify-between gap-4">
                      <span className="text-white/50">Обложки</span>
                      <span className="text-right font-medium">{coverLabel(c.coverVariantIds)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-none flex-col items-end gap-2">
                {/* Стрелки — запасной способ (мобильный/без мыши) */}
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
                      if (confirm(`Удалить категорию «${c.name}»?`)) del.mutate(c.id)
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
        <CategoryEditor
          initial={editing === 'new' ? null : editing}
          covers={covers.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
