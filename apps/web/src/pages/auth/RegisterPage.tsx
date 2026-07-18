import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { ConsentCheckbox, Field, FormError, SocialAuth, submitClass } from '@/components/auth/AuthBits'
import { PhoneField, isPhoneComplete } from '@/components/auth/PhoneField'
import { ApiError, authApi } from '@/lib/api'

/** Совпадает с правилом на сервере: короче — не примет. */
const MIN_PASSWORD = 8

export function RegisterPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD
  const phoneOk = isPhoneComplete(phone)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const { challengeId, email: to } = await authApi.register({
        name,
        email,
        // Отдаём в E.164 — сервер всё равно нормализует, но так меньше сюрпризов.
        phone: `+7${phone}`,
        password,
        consent,
      })
      navigate('/verify', { state: { challengeId, email: to } })
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Не удалось зарегистрироваться. Попробуйте ещё раз.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Регистрация">
      <form onSubmit={submit} className="flex flex-col gap-[13px]">
        <FormError message={error} />
        <Field
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Имя"
          autoComplete="name"
          required
          minLength={2}
        />
        <Field
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          required
        />
        <PhoneField value={phone} onChange={setPhone} required />
        <div>
          <Field
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD}
          />
          {tooShort && (
            <div className="mt-1.5 text-[11px] text-white/45">Не короче {MIN_PASSWORD} символов</div>
          )}
        </div>
        <button type="submit" disabled={busy || !consent || !phoneOk} className={submitClass}>
          {busy ? 'Создаём аккаунт…' : 'Зарегистрироваться'}
        </button>
        <ConsentCheckbox checked={consent} onChange={setConsent} withOffer />
      </form>

      <SocialAuth />

      <div className="mt-[26px] text-center text-sm text-white/55">
        Уже есть аккаунт?{' '}
        <Link to="/login" className="font-semibold">
          Войти
        </Link>
      </div>
    </AuthLayout>
  )
}
