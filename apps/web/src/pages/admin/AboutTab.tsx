import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImageUpload, type ImageRef } from '@/components/admin/ImageUpload'
import { adminApi, ApiError } from '@/lib/api'

const fieldClass =
  'w-full rounded-xl border border-white/[.12] bg-field px-3 py-2.5 text-sm text-bone outline-none transition-colors placeholder:text-white/30 focus:border-gold'

/** Поле «подпись + инпут». */
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  hint?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-white/70">
        {label}
        {hint && <span className="ml-1 font-normal text-white/40">{hint}</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={fieldClass}
      />
    </label>
  )
}

export function AboutTab() {
  const qc = useQueryClient()
  const about = useQuery({ queryKey: ['admin', 'about'], queryFn: adminApi.about })

  const [fio, setFio] = useState('')
  const [role, setRole] = useState('')
  const [desc, setDesc] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [tg, setTg] = useState('')
  const [vk, setVk] = useState('')
  const [max, setMax] = useState('')
  const [photo, setPhoto] = useState<ImageRef | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Заполняем форму загруженными данными.
  useEffect(() => {
    const a = about.data
    if (!a) return
    setFio(a.fio)
    setRole(a.role)
    setDesc(a.desc)
    setPhone(a.phone)
    setEmail(a.email)
    setAddress(a.address)
    setTg(a.tg)
    setVk(a.vk)
    setMax(a.max)
    setPhoto(a.photoImageId && a.photoUrl ? { id: a.photoImageId, url: a.photoUrl } : null)
  }, [about.data])

  const save = useMutation({
    mutationFn: () =>
      adminApi.updateAbout({
        fio: fio.trim(),
        role: role.trim(),
        desc: desc.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        tg: tg.trim(),
        vk: vk.trim(),
        max: max.trim(),
        photoImageId: photo?.id ?? null,
      }),
    onSuccess: () => {
      setError(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      void qc.invalidateQueries({ queryKey: ['admin', 'about'] })
      // Обновляем и публичный блок (футер, контакты).
      void qc.invalidateQueries({ queryKey: ['about'] })
    },
    onError: (e: unknown) =>
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить данные'),
  })

  const emailValid = email.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const canSave = fio.trim().length >= 2 && emailValid && !save.isPending

  return (
    <div>
      <h2 className="font-display m-0 mb-2 text-[22px] font-extrabold">О фотографе</h2>
      <p className="mb-5 text-[13px] text-white/45">
        Эти данные показываются на сайте: в подвале, на странице «Контакты» и в блоке о фотографе.
      </p>

      {about.isLoading && <p className="text-white/50">Загружаем…</p>}

      {about.data && (
        <div className="flex flex-col gap-4">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
              {error}
            </div>
          )}

          <Field label="ФИО" value={fio} onChange={setFio} placeholder="Иванов Александр Петрович" />
          <Field label="Роль / подпись" value={role} onChange={setRole} placeholder="Фотограф, автор альбомов" />

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-white/70">Описание</span>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={4}
              placeholder="Пара предложений о себе и своей работе"
              className={`${fieldClass} resize-y`}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Телефон" value={phone} onChange={setPhone} placeholder="+7 923 000 00 00" />
            <Field
              label="Публичный email"
              hint="(для футера)"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="studio@example.ru"
            />
          </div>

          <Field label="Адрес" value={address} onChange={setAddress} placeholder="Республика Тыва, г. Кызыл" />

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Telegram" hint="(ссылка или @ник)" value={tg} onChange={setTg} placeholder="https://t.me/…" />
            <Field label="VK" hint="(ссылка)" value={vk} onChange={setVk} placeholder="https://vk.com/…" />
            <Field label="MAX" hint="(ссылка)" value={max} onChange={setMax} placeholder="https://max.ru/…" />
          </div>

          <div>
            <ImageUpload label="Фото фотографа" value={photo} onChange={setPhoto} />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!canSave}
              onClick={() => save.mutate()}
              className="rounded-full bg-gold px-6 py-3 text-[15px] font-bold text-on-gold transition-colors hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {save.isPending ? 'Сохраняем…' : 'Сохранить'}
            </button>
            {saved && <span className="text-[13px] font-semibold text-green-300">Сохранено ✓</span>}
            {!emailValid && <span className="text-[13px] text-red-300">Некорректный email</span>}
          </div>
        </div>
      )}
    </div>
  )
}
