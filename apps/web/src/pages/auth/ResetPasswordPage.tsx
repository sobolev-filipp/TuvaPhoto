import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Field, FormError, submitClass } from '@/components/auth/AuthBits'
import { ApiError, authApi } from '@/lib/api'

const MIN_PASSWORD = 8

/** Открывается по ссылке из письма: /reset-password?token=... */
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  // Без токена страница бессмысленна — на восстановление.
  if (!token) return <Navigate to="/forgot-password" replace />

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD
  const mismatch = confirm.length > 0 && confirm !== password
  const canSubmit = password.length >= MIN_PASSWORD && confirm === password

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setBusy(true)
    try {
      await authApi.resetPassword({ token, newPassword: password })
      setDone(true)
      // Сброс закрыл все сессии — уводим на вход с новым паролем.
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Не удалось сменить пароль. Запросите ссылку заново.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Новый пароль">
      {done ? (
        <div className="rounded-xl border border-gold/30 bg-gold/[.08] px-4 py-4 text-sm leading-relaxed text-white/75">
          Пароль изменён. Сейчас переведём вас на страницу входа…
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-[13px]">
          <p className="m-0 mb-1 text-sm leading-relaxed text-white/60">
            Придумайте новый пароль для входа.
          </p>
          <FormError message={error} />
          <div>
            <Field
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Новый пароль"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD}
            />
            {tooShort && (
              <div className="mt-1.5 text-[11px] text-white/45">Не короче {MIN_PASSWORD} символов</div>
            )}
          </div>
          <div>
            <Field
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Повторите пароль"
              autoComplete="new-password"
              required
            />
            {mismatch && <div className="mt-1.5 text-[11px] text-red-300">Пароли не совпадают</div>}
          </div>
          <button type="submit" disabled={busy || !canSubmit} className={submitClass}>
            {busy ? 'Сохраняем…' : 'Сохранить пароль'}
          </button>
        </form>
      )}

      <div className="mt-[26px] text-center text-sm text-white/55">
        <Link to="/login" className="font-semibold">
          ← Вернуться ко входу
        </Link>
      </div>
    </AuthLayout>
  )
}
