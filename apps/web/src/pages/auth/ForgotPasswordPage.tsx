import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Field, FormError, submitClass } from '@/components/auth/AuthBits'
import { ApiError, authApi } from '@/lib/api'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await authApi.forgotPassword({ email })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить письмо')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Восстановление пароля">
      {sent ? (
        // Формулировка намеренно обтекаемая: подтверждать наличие email в базе
        // нельзя — иначе форма станет способом проверять, кто зарегистрирован.
        <div className="rounded-xl border border-gold/30 bg-gold/[.08] px-4 py-4 text-sm leading-relaxed text-white/75">
          Если такой email зарегистрирован, мы отправили на него письмо с инструкцией.
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-[13px]">
          <p className="m-0 mb-1 text-sm leading-[1.5] text-white/60">
            Укажите email — мы отправим ссылку для восстановления доступа.
          </p>
          <FormError message={error} />
          <Field
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            required
          />
          <button type="submit" disabled={busy} className={submitClass}>
            {busy ? 'Отправляем…' : 'Отправить письмо'}
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
