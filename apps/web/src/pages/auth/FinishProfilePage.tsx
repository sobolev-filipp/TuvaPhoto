import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Field, FormError, submitClass } from '@/components/auth/AuthBits'
import { PhoneField, isPhoneComplete } from '@/components/auth/PhoneField'
import { ApiError, authApi } from '@/lib/api'
import { useAuth } from '@/store/auth'

/**
 * Второй шаг онбординга владельца: данные о фотографе (ФИО, адрес, телефон).
 * Идут в блок «О фотографе» на сайте. Показывается, пока стоит флаг
 * mustCompleteProfile; уводить некуда, пока не заполнено.
 */
export function FinishProfilePage() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const ready = useAuth((s) => s.ready)
  const setUser = useAuth((s) => s.setUser)

  const [fio, setFio] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!ready) return null
  if (!user) return <Navigate to="/login" replace />
  // Сначала — обязательная смена доступов, если ещё не сделана.
  if (user.mustChangeCredentials) return <Navigate to="/finish-setup" replace />
  if (!user.mustCompleteProfile) return <Navigate to="/profile" replace />

  const canSubmit = fio.trim().length >= 2 && address.trim().length >= 2 && isPhoneComplete(phone)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setBusy(true)
    try {
      const { user: updated } = await authApi.completeProfile({
        fio: fio.trim(),
        address: address.trim(),
        phone: `+7${phone}`,
      })
      setUser(updated)
      navigate('/profile', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить данные')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="О фотографе">
      <p className="m-0 mb-6 text-sm leading-relaxed text-white/60">
        Осталось заполнить данные о себе — они появятся на сайте в разделе
        «Контакты» и в подвале. Позже сможете изменить их в админ-панели.
      </p>

      <form onSubmit={submit} className="flex flex-col gap-[13px]">
        <FormError message={error} />
        <div>
          <div className="mb-2 text-[13px] font-semibold text-white/55">ФИО</div>
          <Field
            value={fio}
            onChange={(e) => setFio(e.target.value)}
            placeholder="Иванов Александр Петрович"
            autoComplete="name"
            required
            minLength={2}
          />
        </div>
        <div>
          <div className="mb-2 text-[13px] font-semibold text-white/55">Адрес</div>
          <Field
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Республика Тыва, г. Кызыл"
            autoComplete="street-address"
            required
            minLength={2}
          />
        </div>
        <div>
          <div className="mb-2 text-[13px] font-semibold text-white/55">Телефон</div>
          <PhoneField value={phone} onChange={setPhone} required />
        </div>
        <button type="submit" disabled={busy || !canSubmit} className={submitClass}>
          {busy ? 'Сохраняем…' : 'Сохранить и продолжить'}
        </button>
      </form>
    </AuthLayout>
  )
}
