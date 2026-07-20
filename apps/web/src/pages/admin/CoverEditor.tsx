import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/Modal'
import { ImageUpload, type ImageRef } from '@/components/admin/ImageUpload'
import { adminApi, ApiError, type AdminCover } from '@/lib/api'

const fieldClass =
  'w-full rounded-xl border border-white/[.12] bg-field px-3 py-2.5 text-sm text-bone outline-none transition-colors placeholder:text-white/30 focus:border-gold'

/**
 * Редактор обложки (создание и правка) в модалке. Используется во вкладке «Обложки»
 * и при создании альбома (там задаётся `defaultCategoryId`, а `onSaved` возвращает id
 * созданной обложки, чтобы сразу её выбрать).
 */
export function CoverEditor({
  initial,
  categories,
  defaultCategoryId,
  onSaved,
  onClose,
}: {
  initial: AdminCover | null
  categories: { id: string; name: string }[]
  defaultCategoryId?: string
  onSaved?: (id: string) => void
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [label, setLabel] = useState(initial?.label ?? '')
  const [priceMod, setPriceMod] = useState(initial ? String(initial.priceMod) : '0')
  const [front, setFront] = useState<ImageRef | null>(
    initial?.imageId && initial.imageUrl ? { id: initial.imageId, url: initial.imageUrl } : null,
  )
  const [back, setBack] = useState<ImageRef | null>(
    initial?.backImageId && initial.backImageUrl
      ? { id: initial.backImageId, url: initial.backImageUrl }
      : null,
  )
  const [isActive, setIsActive] = useState(initial?.isActive ?? true)
  const [catIds, setCatIds] = useState<string[]>(
    initial?.categoryIds ?? (defaultCategoryId ? [defaultCategoryId] : []),
  )
  const [error, setError] = useState<string | null>(null)

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'covers'] })
    // Обложки видны и в категориях (набор обложек категории), и в конструкторе.
    void qc.invalidateQueries({ queryKey: ['admin', 'categories'] })
    void qc.invalidateQueries({ queryKey: ['catalog-options'] })
  }
  const onError = (e: unknown) =>
    setError(e instanceof ApiError ? e.message : 'Не удалось сохранить обложку')

  const save = useMutation({
    mutationFn: async () => {
      if (initial) {
        // При редактировании фото передней обложки менять необязательно —
        // шлём imageId только если его действительно выбрали (иначе не трогаем).
        await adminApi.updateCover(initial.id, {
          label: label.trim(),
          priceMod: Number(priceMod) || 0,
          ...(front ? { imageId: front.id } : {}),
          backImageId: back?.id ?? null,
          isActive,
          categoryIds: catIds,
        })
        return initial.id
      }
      const { id } = await adminApi.createCover({
        label: label.trim(),
        priceMod: Number(priceMod) || 0,
        imageId: front!.id, // при создании фото обязательно (гарантирует canSave)
        backImageId: back?.id ?? null,
        isActive,
        categoryIds: catIds,
      })
      return id
    },
    onSuccess: (id) => {
      invalidate()
      onSaved?.(id)
      onClose()
    },
    onError,
  })

  const toggleCat = (id: string) =>
    setCatIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const labelValid = label.trim().length >= 2
  const priceValid = Number.isInteger(Number(priceMod)) && Number(priceMod) >= 0
  // Фото передней обложки обязательно только при создании: у старых/сид-обложек
  // фото может не быть, но их всё равно нужно уметь редактировать (напр. выключить).
  const canSave = labelValid && priceValid && (initial !== null || front !== null) && !save.isPending

  return (
    <Modal
      title={initial ? `Обложка «${initial.label}»` : 'Новая обложка'}
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
            placeholder="Например, Кожа с тиснением"
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-white/70">Надбавка к цене, ₽</span>
          <input
            type="number"
            min={0}
            value={priceMod}
            onChange={(e) => setPriceMod(e.target.value)}
            className={fieldClass}
          />
        </label>

        <div className="flex flex-wrap gap-6">
          <ImageUpload
            label={initial ? 'Передняя обложка' : 'Передняя обложка *'}
            value={front}
            onChange={setFront}
          />
          <ImageUpload label="Задняя обложка" value={back} onChange={setBack} />
        </div>
        {!initial && front === null && (
          <div className="text-[12px] text-white/40">Фото передней обложки обязательно.</div>
        )}
        {initial && front === null && (
          <div className="text-[12px] text-white/40">
            Фото не задано — обложка покажется с плейсхолдером. Можно сохранить и без него.
          </div>
        )}

        {/* Категории, к которым привязана обложка. */}
        <div>
          <div className="mb-2 text-[13px] font-semibold text-white/70">
            Категории {catIds.length > 0 && `· выбрано ${catIds.length}`}
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const on = catIds.includes(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCat(c.id)}
                  className="cursor-pointer rounded-full border-2 px-3.5 py-2 text-[13px] font-semibold transition-colors"
                  style={{
                    borderColor: on ? '#E4B45C' : 'rgba(255,255,255,.12)',
                    background: on ? 'rgba(228,180,92,.1)' : 'transparent',
                    color: on ? '#E4B45C' : undefined,
                  }}
                >
                  {c.name}
                </button>
              )
            })}
          </div>
          {catIds.length === 0 && (
            <div className="mt-2 text-[12px] text-white/40">
              Обложка без категорий не появится в конструкторе и в подборе для альбома.
            </div>
          )}
        </div>

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
            Активна <span className="font-normal text-white/45">— доступна для выбора</span>
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
