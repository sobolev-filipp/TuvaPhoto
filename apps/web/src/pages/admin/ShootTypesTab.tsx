import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { adminApi, ApiError, type AdminShootType } from '@/lib/api'
import { formatPrice } from '@/domain/pricing'

const fieldClass =
  'w-full rounded-xl border border-white/[.12] bg-field px-3 py-2.5 text-sm text-bone outline-none transition-colors placeholder:text-white/30 focus:border-gold'

/** Редактор вида съёмки (создание и правка) в модалке. */
function ShootTypeEditor({
  initial,
  onClose,
}: {
  initial: AdminShootType | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [label, setLabel] = useState(initial?.label ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [price, setPrice] = useState(initial ? String(initial.price) : '')
  const [isActive, setIsActive] = useState(initial?.isActive ?? true)
  const [error, setError] = useState<string | null>(null)

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['admin', 'shoot-types'] })
  const onError = (e: unknown) =>
    setError(e instanceof ApiError ? e.message : 'Не удалось сохранить вид съёмки')

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        label: label.trim(),
        description: description.trim(),
        price: Number(price),
        isActive,
      }
      if (initial) await adminApi.updateShootType(initial.id, body)
      else await adminApi.createShootType(body)
    },
    onSuccess: () => {
      invalidate()
      onClose()
    },
    onError,
  })

  const priceNum = Number(price)
  const labelValid = label.trim().length >= 2
  const priceValid = price !== '' && Number.isInteger(priceNum) && priceNum >= 0
  const canSave = labelValid && priceValid && !save.isPending

  return (
    <Modal
      title={initial ? `Вид съёмки «${initial.label}»` : 'Новый вид съёмки'}
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
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Например, Портрет в студии"
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-white/70">Описание</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Короткое описание для конструктора (необязательно)"
            className={`${fieldClass} resize-y`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-white/70">Цена, ₽</span>
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
            className={fieldClass}
          />
        </label>

        <button
          type="button"
          onClick={() => setIsActive((v) => !v)}
          className="flex items-center gap-3 rounded-xl border border-white/[.12] px-3 py-3 text-left"
        >
          <span
            className="flex h-5 w-5 flex-none items-center justify-center rounded-md border-2 text-[12px] font-extrabold text-on-gold"
            style={{
              borderColor: isActive ? '#E4B45C' : 'rgba(255,255,255,.25)',
              background: isActive ? '#E4B45C' : 'transparent',
            }}
          >
            {isActive ? '✓' : ''}
          </span>
          <span className="text-sm font-semibold">
            Активен <span className="font-normal text-white/45">— показывать в конструкторе</span>
          </span>
        </button>

        <button
          type="button"
          disabled={!canSave}
          onClick={() => save.mutate()}
          className="rounded-full bg-gold px-6 py-3 text-[15px] font-bold text-on-gold transition-colors hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {save.isPending ? 'Сохраняем…' : initial ? 'Сохранить' : 'Создать'}
        </button>
      </div>
    </Modal>
  )
}

export function ShootTypesTab() {
  const qc = useQueryClient()
  const shoots = useQuery({ queryKey: ['admin', 'shoot-types'], queryFn: adminApi.shootTypes })

  // null — редактор закрыт; 'new' — создание; объект — правка.
  const [editing, setEditing] = useState<AdminShootType | 'new' | null>(null)

  // Локальная копия для мгновенного отклика при перетаскивании.
  const [items, setItems] = useState<AdminShootType[]>([])
  useEffect(() => {
    if (shoots.data) setItems(shoots.data)
  }, [shoots.data])

  const dragFrom = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  // Подтверждение удаления через попап (вместо нативных confirm/alert).
  const [confirming, setConfirming] = useState<AdminShootType | null>(null)
  const [delError, setDelError] = useState<string | null>(null)

  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteShootType(id),
    onSuccess: () => {
      setConfirming(null)
      void qc.invalidateQueries({ queryKey: ['admin', 'shoot-types'] })
    },
    onError: (e: unknown) =>
      setDelError(e instanceof ApiError ? e.message : 'Не удалось удалить вид съёмки'),
  })

  const reorder = useMutation({
    mutationFn: (ids: string[]) => adminApi.reorderShootTypes(ids),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'shoot-types'] }),
  })

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setItems(next)
    reorder.mutate(next.map((s) => s.id))
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <h2 className="font-display m-0 text-[22px] font-extrabold">Виды съёмки</h2>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="cursor-pointer rounded-full bg-gold px-4 py-2 text-[13px] font-bold text-on-gold transition-colors hover:bg-gold-hover"
        >
          + Добавить
        </button>
      </div>
      <p className="mb-5 text-[13px] text-white/45">
        Виды съёмки выбираются в конструкторе и назначаются категориям. Порядок карточек = порядок
        вывода. Перетаскивайте за значок ⠿ или двигайте стрелками.
      </p>

      {shoots.isLoading && <p className="text-white/50">Загружаем виды съёмки…</p>}
      {shoots.isError && <p className="text-red-300">Не удалось загрузить виды съёмки.</p>}
      {shoots.data?.length === 0 && <p className="text-white/50">Видов съёмки пока нет.</p>}

      <div className="flex flex-col gap-3">
        {items.map((s, i) => (
          <div
            key={s.id}
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
                <div className="flex items-center gap-2">
                  <span className="font-display text-[16px] font-bold">{s.label}</span>
                  {!s.isActive && (
                    <span className="flex-none rounded-full border border-white/20 px-2 py-0.5 text-[11px] font-semibold text-white/50">
                      Выключен
                    </span>
                  )}
                </div>
                {s.description && (
                  <div className="mt-1 text-[13px] text-white/50">{s.description}</div>
                )}
                <div className="mt-2 font-display text-[15px] font-bold text-gold">
                  {formatPrice(s.price)}
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
                    onClick={() => setEditing(s)}
                    className="cursor-pointer rounded-lg border border-white/15 px-3 py-1.5 text-[13px] font-semibold text-bone transition-colors hover:border-gold/50 hover:text-gold"
                  >
                    Изменить
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDelError(null)
                      setConfirming(s)
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
        <ShootTypeEditor
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {confirming && (
        <ConfirmDialog
          title="Удалить вид съёмки"
          message={`Удалить вид съёмки «${confirming.label}»? Это действие необратимо.`}
          busy={del.isPending}
          error={delError}
          onConfirm={() => del.mutate(confirming.id)}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  )
}
