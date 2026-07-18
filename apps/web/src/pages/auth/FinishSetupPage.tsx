import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Field, FormError, submitClass } from '@/components/auth/AuthBits'
import { ApiError, authApi } from '@/lib/api'
import { useAuth } from '@/store/auth'

const MIN_PASSWORD = 8

/**
 * Обязательная смена заводских доступов владельца.
 *
 * Показывается только пока стоит флаг mustChangeCredentials. Уводить отсюда
 * некуда, пока доступы не сменены, — так временный пароль из .env не остаётся
 * рабочим. Требуем ввести текущий (временный) пароль: это же и подтверждение,
 * что за экраном тот, кто действительно вошёл.
 */
export function FinishSetupPage() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const ready = useAuth((s) => s.ready)
  const setUser = useAuth((s) => s.setUser)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!ready) return null
  // Не залогинен — на вход. Флаг уже снят — здесь делать нечего.
  if (!user) return <Navigate to="/login" replace />
  if (!user.mustChangeCredentials) return <Navigate to="/profile" replace />

  const tooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD
  const mismatch = confirm.length > 0 && confirm !== newPassword
  const canSubmit =
    currentPassword.length > 0 &&
    newEmail.length > 3 &&
    newPassword.length >= MIN_PASSWORD &&
    confirm === newPassword

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setBusy(true)
    try {
      const { user: updated } = await authApi.changeCredentials({
        currentPassword,
        newEmail,
        newPassword,
      })
      setUser(updated)
      // Дальше — второй шаг онбординга: данные о фотографе.
      navigate(updated.mustCompleteProfile ? '/finish-profile' : '/profile', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сменить доступы')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Смените доступы">
      <p className="m-0 mb-6 text-sm leading-relaxed text-white/60">
        Вы вошли по временным логину и паролю. Задайте свои — это нужно один раз,
        для безопасности. Временный пароль после этого перестанет работать.
      </p>

      <form onSubmit={submit} className="flex flex-col gap-[13px]">
        <FormError message={error} />

        <div>
          <div className="mb-2 text-[13px] font-semibold text-white/55">Текущий (временный) пароль</div>
          <Field
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Временный пароль"
            autoComplete="current-password"
            required
          />
        </div>

        <div className="mt-2 h-px bg-white/[.08]" />

        <div>
          <div className="mb-2 text-[13px] font-semibold text-white/55">Новый email (логин)</div>
          <Field
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Новый email"
            // Не даём браузеру подставить сюда старый/сохранённый email —
            // это поле для НОВОГО адреса.
            autoComplete="off"
            required
          />
        </div>

        <div>
          <div className="mb-2 text-[13px] font-semibold text-white/55">Новый пароль</div>
          <Field
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
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
            placeholder="Повторите новый пароль"
            autoComplete="new-password"
            required
          />
          {mismatch && <div className="mt-1.5 text-[11px] text-red-300">Пароли не совпадают</div>}
        </div>

        <button type="submit" disabled={busy || !canSubmit} className={submitClass}>
          {busy ? 'Сохраняем…' : 'Сохранить и продолжить'}
        </button>
      </form>
    </AuthLayout>
  )
}
