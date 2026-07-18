import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { ConsentCheckbox, Field, FormError, SocialAuth, submitClass } from '@/components/auth/AuthBits'
import { ApiError, authApi } from '@/lib/api'

/** Причины из oauth_error в понятный текст. */
const oauthErrorText: Record<string, string> = {
  provider: 'Провайдер отклонил вход. Попробуйте ещё раз.',
  state: 'Сессия входа устарела. Попробуйте войти заново.',
  no_code: 'Провайдер не вернул данные для входа.',
  exchange: 'Не удалось получить данные от провайдера.',
  session: 'Вход не завершился. Попробуйте ещё раз.',
}

export function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const oauthError = params.get('oauth_error')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(
    oauthError ? (oauthErrorText[oauthError] ?? 'Не удалось войти через соцсеть.') : null,
  )
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const { challengeId, email: to } = await authApi.login({ email, password, consent })
      // Код ушёл на почту: пароль сам по себе вход не даёт.
      navigate('/verify', { state: { challengeId, email: to } })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось войти. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Вход">
      <form onSubmit={submit} className="flex flex-col gap-[13px]">
        <FormError message={error} />
        <Field
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          required
        />
        <Field
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль"
          autoComplete="current-password"
          required
        />
        <div className="text-right">
          <Link to="/forgot-password" className="text-[13px] text-white/60 hover:text-gold">
            Забыли пароль?
          </Link>
        </div>
        <button type="submit" disabled={busy || !consent} className={submitClass}>
          {busy ? 'Проверяем…' : 'Войти'}
        </button>
        <ConsentCheckbox checked={consent} onChange={setConsent} />
      </form>

      <SocialAuth />

      <div className="mt-[26px] text-center text-sm text-white/55">
        Нет аккаунта?{' '}
        <Link to="/register" className="font-semibold">
          Зарегистрироваться
        </Link>
      </div>
    </AuthLayout>
  )
}
