import { useRef, useState } from 'react'
import { adminApi, ApiError, type UploadedImageInfo } from '@/lib/api'

/**
 * Загрузка одного изображения для админки. Показывает превью загруженного файла,
 * позволяет заменить или убрать. Сам файл уходит на сервер сразу при выборе,
 * наружу отдаётся уже готовая запись Image (id + url).
 */
export function ImageUpload({
  value,
  onChange,
  label,
}: {
  value: UploadedImageInfo | null
  onChange: (img: UploadedImageInfo | null) => void
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = () => inputRef.current?.click()

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Сброс value — иначе повторный выбор того же файла не вызовет onChange.
    e.target.value = ''
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      onChange(await adminApi.uploadImage(file))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить изображение')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {label && <div className="mb-1.5 text-[13px] font-semibold text-white/70">{label}</div>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onFile}
        className="hidden"
      />

      {value ? (
        <div className="inline-flex flex-col gap-2 rounded-xl border border-white/[.12] bg-surface-2 p-2">
          <img
            src={value.url}
            alt="Загруженное изображение"
            className="block max-h-[160px] w-auto rounded-lg object-contain"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={pick}
              disabled={busy}
              className="cursor-pointer rounded-lg border border-white/15 px-3 py-1.5 text-[13px] font-semibold text-bone transition-colors hover:border-gold/50 hover:text-gold disabled:opacity-50"
            >
              {busy ? 'Загружаем…' : 'Заменить'}
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="cursor-pointer rounded-lg border border-red-400/30 px-3 py-1.5 text-[13px] font-semibold text-red-300 transition-colors hover:border-red-400/60"
            >
              Убрать
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          className="flex h-[110px] w-full max-w-[240px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-white/[.15] text-[13px] font-semibold text-white/55 transition-colors hover:border-gold/50 hover:text-gold disabled:opacity-50"
        >
          <span className="text-2xl leading-none">+</span>
          {busy ? 'Загружаем…' : 'Загрузить изображение'}
        </button>
      )}

      {error && <div className="mt-1.5 text-[12px] text-red-300">{error}</div>}
      <div className="mt-1.5 text-[11px] text-white/35">JPG, PNG или WebP, до 15 МБ</div>
    </div>
  )
}
