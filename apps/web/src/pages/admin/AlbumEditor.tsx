import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImageUpload, type ImageRef } from '@/components/admin/ImageUpload'
import {
  adminApi,
  ApiError,
  authApi,
  type AlbumInput,
  type AlbumOrientation,
  type SpreadLayout,
} from '@/lib/api'
import { CoverEditor } from './CoverEditor'

const fieldClass =
  'w-full rounded-xl border border-white/[.12] bg-field px-3 py-2.5 text-sm text-bone outline-none transition-colors placeholder:text-white/30 focus:border-gold'

/** Разворот в состоянии редактора (с превью изображений). */
interface SpreadState {
  key: string
  label: string
  layout: SpreadLayout
  image: ImageRef | null
  rightImage: ImageRef | null
}

const newSpread = (): SpreadState => ({
  key: Math.random().toString(36).slice(2),
  label: '',
  layout: 'SINGLE',
  image: null,
  rightImage: null,
})

/** Кнопка-переключатель (вкл/выкл) в золотом стиле. */
function ToggleButton({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-xl border-2 px-4 py-2.5 text-[13px] font-semibold transition-colors"
      style={{
        borderColor: on ? '#E4B45C' : 'rgba(255,255,255,.12)',
        background: on ? 'rgba(228,180,92,.1)' : 'transparent',
        color: on ? '#E4B45C' : undefined,
      }}
    >
      {children}
    </button>
  )
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-white/70">{label}</span>
      <input type="number" min={0} value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass} />
    </label>
  )
}

export function AlbumEditor({ id, onDone }: { id: string | null; onDone: () => void }) {
  const qc = useQueryClient()
  const isEdit = id !== null

  // Справочники для выбора.
  const options = useQuery({ queryKey: ['catalog-options'], queryFn: authApi.catalogOptions })
  const categories = options.data?.categories ?? []
  const allShootTypes = options.data?.shootTypes ?? []
  // Обложки (готовые CoverVariant) — для подбора по категории.
  const coversQuery = useQuery({ queryKey: ['admin', 'covers'], queryFn: adminApi.covers })
  const allCovers = coversQuery.data ?? []

  // Существующий альбом при редактировании.
  const existing = useQuery({
    queryKey: ['admin', 'album', id],
    queryFn: () => adminApi.album(id as string),
    enabled: isEdit,
  })

  const [name, setName] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [desc, setDesc] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [shootIds, setShootIds] = useState<string[]>([])
  const [orientation, setOrientation] = useState<AlbumOrientation>('LANDSCAPE')
  const [format, setFormat] = useState('')
  const [minSpreads, setMinSpreads] = useState('10')
  const [maxSpreads, setMaxSpreads] = useState('40')
  const [perSpread, setPerSpread] = useState('420')
  const [price, setPrice] = useState('15000')
  const [coverVariantId, setCoverVariantId] = useState<string | null>(null)
  const [coverEditorOpen, setCoverEditorOpen] = useState(false)
  const [isPublished, setIsPublished] = useState(false)
  const [isFeatured, setIsFeatured] = useState(false)
  const [inConstructor, setInConstructor] = useState(false)
  const [spreads, setSpreads] = useState<SpreadState[]>([newSpread()])
  const [error, setError] = useState<string | null>(null)

  // Заполняем форму данными существующего альбома.
  useEffect(() => {
    const a = existing.data
    if (!a) return
    setName(a.name)
    setSubtitle(a.subtitle)
    setDesc(a.desc)
    setCategoryId(a.categoryId)
    setShootIds(a.shootTypeIds)
    setOrientation(a.orientation)
    setFormat(a.format)
    setMinSpreads(String(a.minSpreads))
    setMaxSpreads(String(a.maxSpreads))
    setPerSpread(String(a.perSpread))
    setPrice(String(a.price))
    setCoverVariantId(a.coverVariantId)
    setIsPublished(a.isPublished)
    setIsFeatured(a.isFeatured)
    setInConstructor(a.inConstructor)
    setSpreads(
      a.spreads.length
        ? a.spreads.map((s) => ({
            key: Math.random().toString(36).slice(2),
            label: s.label,
            layout: s.layout,
            image: s.image,
            rightImage: s.rightImage,
          }))
        : [newSpread()],
    )
  }, [existing.data])

  // Первая категория по умолчанию при создании.
  useEffect(() => {
    if (!isEdit && !categoryId && categories.length) setCategoryId(categories[0].id)
  }, [isEdit, categoryId, categories])

  // Виды съёмки зависят от выбранной категории.
  const selectedCategory = categories.find((c) => c.id === categoryId)
  const shootTypes = selectedCategory
    ? allShootTypes.filter((s) => selectedCategory.shootTypeIds.includes(s.id))
    : []

  const toggleShoot = (sid: string) =>
    setShootIds((prev) => (prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]))

  // Обложки, доступные для выбранной категории (активные + уже выбранная).
  const availableCovers = allCovers.filter(
    (c) => c.categoryIds.includes(categoryId) && (c.isActive || c.id === coverVariantId),
  )
  const selectedCover = allCovers.find((c) => c.id === coverVariantId) ?? null

  // Смена категории: убираем виды съёмки и обложку, которых нет в новой категории.
  const chooseCategory = (id: string) => {
    setCategoryId(id)
    const cat = categories.find((c) => c.id === id)
    if (cat) setShootIds((prev) => prev.filter((sid) => cat.shootTypeIds.includes(sid)))
    setCoverVariantId((prev) => {
      if (!prev) return prev
      const cover = allCovers.find((c) => c.id === prev)
      return cover && cover.categoryIds.includes(id) ? prev : null
    })
  }

  const patchSpread = (key: string, patch: Partial<SpreadState>) =>
    setSpreads((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)))

  const save = useMutation({
    mutationFn: async () => {
      const body: AlbumInput = {
        name: name.trim(),
        subtitle: subtitle.trim(),
        desc: desc.trim(),
        categoryId,
        shootTypeIds: shootIds,
        orientation,
        minSpreads: Number(minSpreads) || 1,
        maxSpreads: Number(maxSpreads) || 1,
        perSpread: Number(perSpread) || 0,
        price: Number(price) || 0,
        format: format.trim(),
        coverVariantId,
        isPublished,
        isFeatured,
        inConstructor,
        spreads: spreads.map((s) => ({
          label: s.label.trim(),
          layout: s.layout,
          imageId: s.image?.id ?? null,
          rightImageId: s.layout === 'DOUBLE' ? (s.rightImage?.id ?? null) : null,
        })),
      }
      if (isEdit) await adminApi.updateAlbum(id as string, body)
      else await adminApi.createAlbum(body)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'albums'] })
      onDone()
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Не удалось сохранить альбом'),
  })

  const canSave = name.trim().length >= 2 && categoryId !== '' && !save.isPending

  return (
    <div>
      <button
        type="button"
        onClick={onDone}
        className="mb-5 inline-block cursor-pointer border-none bg-transparent p-0 text-sm font-semibold text-white/60 hover:text-gold"
      >
        ← К списку альбомов
      </button>

      <h2 className="font-display m-0 mb-5 text-[22px] font-extrabold">
        {isEdit ? 'Редактирование альбома' : 'Новый альбом'}
      </h2>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-5">
        {/* Основное */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-white/70">Название</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} placeholder="Выпускной 2026" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-white/70">Подзаголовок</span>
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-white/70">Описание</span>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className={fieldClass} />
        </label>

        {/* Категория */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-white/70">Категория</span>
          <select value={categoryId} onChange={(e) => chooseCategory(e.target.value)} className={fieldClass}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        {/* Виды съёмки */}
        <div>
          <div className="mb-2 text-[13px] font-semibold text-white/70">Виды съёмки</div>
          <div className="flex flex-wrap gap-2">
            {shootTypes.map((s) => {
              const on = shootIds.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleShoot(s.id)}
                  className="cursor-pointer rounded-full border-2 px-3.5 py-2 text-[13px] font-semibold transition-colors"
                  style={{
                    borderColor: on ? '#E4B45C' : 'rgba(255,255,255,.12)',
                    background: on ? 'rgba(228,180,92,.1)' : 'transparent',
                    color: on ? '#E4B45C' : undefined,
                  }}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Ориентация */}
        <div>
          <div className="mb-2 text-[13px] font-semibold text-white/70">Ориентация</div>
          <div className="flex gap-2">
            {(
              [
                { v: 'LANDSCAPE', label: 'Альбомная (гориз.)' },
                { v: 'PORTRAIT', label: 'Книжная (верт.)' },
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

        {/* Числа */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumField label="Мин. разворотов" value={minSpreads} onChange={setMinSpreads} />
          <NumField label="Макс. разворотов" value={maxSpreads} onChange={setMaxSpreads} />
          <NumField label="Цена за разворот, ₽" value={perSpread} onChange={setPerSpread} />
          <NumField label="Цена «от», ₽" value={price} onChange={setPrice} />
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-white/70">Формат</span>
            <input value={format} onChange={(e) => setFormat(e.target.value)} className={fieldClass} placeholder="21×30 см" />
          </label>
        </div>

        {/* Обложка — выбор готовой обложки категории или создание новой */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[13px] font-semibold text-white/70">Обложка</span>
            <button
              type="button"
              onClick={() => setCoverEditorOpen(true)}
              disabled={!categoryId}
              className="cursor-pointer rounded-full border border-white/15 px-3 py-1.5 text-[13px] font-semibold text-bone transition-colors hover:border-gold/50 hover:text-gold disabled:cursor-default disabled:opacity-40"
            >
              + Создать обложку
            </button>
          </div>

          {availableCovers.length === 0 ? (
            <div className="rounded-xl border border-white/[.09] bg-surface-2 px-4 py-4 text-[13px] text-white/45">
              Для этой категории пока нет обложек. Создайте новую — она привяжется к категории.
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {/* Вариант «без обложки» */}
              <button
                type="button"
                onClick={() => setCoverVariantId(null)}
                className="flex h-[132px] w-[104px] flex-col items-center justify-center rounded-xl border-2 text-[12px] font-semibold transition-colors"
                style={{
                  borderColor: coverVariantId === null ? '#E4B45C' : 'rgba(255,255,255,.12)',
                  background: coverVariantId === null ? 'rgba(228,180,92,.1)' : 'transparent',
                  color: coverVariantId === null ? '#E4B45C' : 'rgba(255,255,255,.5)',
                }}
              >
                Без обложки
              </button>

              {availableCovers.map((c) => {
                const on = c.id === coverVariantId
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCoverVariantId(c.id)}
                    className="flex w-[104px] flex-col overflow-hidden rounded-xl border-2 text-left transition-colors"
                    style={{ borderColor: on ? '#E4B45C' : 'rgba(255,255,255,.12)' }}
                    title={c.label}
                  >
                    <div className="h-[100px] w-full bg-black/20">
                      {c.imageUrl ? (
                        <img src={c.imageUrl} alt={c.label} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[11px] text-white/30">
                          нет фото
                        </div>
                      )}
                    </div>
                    <div
                      className="truncate px-2 py-1.5 text-[12px] font-semibold"
                      style={{ color: on ? '#E4B45C' : undefined }}
                    >
                      {c.label}
                      {c.priceMod > 0 && <span className="opacity-60"> +{c.priceMod}₽</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
          {selectedCover?.backImageUrl && (
            <div className="mt-2 text-[12px] text-white/45">
              У обложки задана задняя сторона — она подставится автоматически.
            </div>
          )}
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
              <div key={s.key} className="rounded-2xl border border-white/[.09] bg-surface-2 p-4">
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

                {/* Режим */}
                <div className="mb-3 flex gap-2">
                  {(
                    [
                      { v: 'SINGLE', label: '1 фото на разворот' },
                      { v: 'DOUBLE', label: '2 фото (по странице)' },
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

        {/* Флаги — кнопками-переключателями */}
        <div className="flex flex-wrap gap-2">
          <ToggleButton on={isPublished} onClick={() => setIsPublished((v) => !v)}>
            {isPublished ? '✓ Опубликован' : 'Опубликовать'}
          </ToggleButton>
          <ToggleButton on={isFeatured} onClick={() => setIsFeatured((v) => !v)}>
            {isFeatured ? '✓ На главной' : 'Показать на главной'}
          </ToggleButton>
          <ToggleButton on={inConstructor} onClick={() => setInConstructor((v) => !v)}>
            {inConstructor ? '✓ В конструкторе' : 'Готовый вариант в конструкторе'}
          </ToggleButton>
        </div>
        <div className="-mt-2 text-[12px] text-white/40">
          «Готовый вариант» показывает альбом в конструкторе как пресет (нужна публикация).
          Число разворотов считается автоматически по добавленным ниже разворотам.
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            disabled={!canSave}
            onClick={() => save.mutate()}
            className="rounded-full bg-gold px-6 py-3 text-[15px] font-bold text-on-gold transition-colors hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {save.isPending ? 'Сохраняем…' : isEdit ? 'Сохранить' : 'Создать'}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="rounded-full border border-white/15 px-6 py-3 text-[15px] font-semibold text-bone hover:border-gold/50 hover:text-gold"
          >
            Отмена
          </button>
        </div>
      </div>

      {coverEditorOpen && (
        <CoverEditor
          initial={null}
          categories={categories}
          defaultCategoryId={categoryId}
          onSaved={(id) => setCoverVariantId(id)}
          onClose={() => setCoverEditorOpen(false)}
        />
      )}
    </div>
  )
}
