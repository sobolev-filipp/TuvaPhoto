import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { FormError, submitClass } from '@/components/auth/AuthBits'
import { ApiError, authApi } from '@/lib/api'
import { useAuth } from '@/store/auth'
import { takePostLoginRedirect } from '@/lib/session-return'

const LENGTH = 4

interface VerifyState {
  challengeId: string
  email: string
}

export function VerifyPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setSession = useAuth((s) => s.setSession)
  const state = location.state as VerifyState | null

  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  // Секунды до следующей возможной отправки. Код только что прислали при входе,
  // поэтому стартуем с кулдауна — иначе мгновенный повтор упрётся в 429.
  const [cooldown, setCooldown] = useState(45)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => inputs.current[0]?.focus(), [])

  // Тикаем кулдаун вниз, пока не 0.
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  // Сюда попадают только после login/register: без challengeId проверять нечего.
  if (!state?.challengeId) return <Navigate to="/login" replace />

  const code = digits.join('')

  const submit = async (value: string) => {
    if (value.length !== LENGTH || busy) return
    setError(null)
    setBusy(true)
    try {
      const { accessToken, user } = await authApi.verify({ challengeId: state.challengeId, code: value })
      setSession(accessToken, user)
      // Если на вход увели из конструктора — вернём туда (с восстановлением выбора).
      const redirect = takePostLoginRedirect()
      // Онбординг владельца по шагам: сначала смена доступов, затем данные о себе.
      const to = user.mustChangeCredentials
        ? '/finish-setup'
        : user.mustCompleteProfile
          ? '/finish-profile'
          : (redirect ?? '/profile')
      navigate(to, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось подтвердить код')
      setDigits(Array(LENGTH).fill(''))
      inputs.current[0]?.focus()
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    if (cooldown > 0 || resending) return
    setResending(true)
    setError(null)
    setNotice(null)
    try {
      const { cooldown: next } = await authApi.resendCode({ challengeId: state.challengeId })
      setCooldown(next)
      setNotice('Новый код отправлен')
      setDigits(Array(LENGTH).fill(''))
      inputs.current[0]?.focus()
    } catch (err) {
      // 429 приносит retryAfter — заводим таймер по нему.
      const data = err instanceof ApiError ? (err.data as { retryAfter?: number } | undefined) : undefined
      if (data?.retryAfter) setCooldown(data.retryAfter)
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить код')
    } finally {
      setResending(false)
    }
  }

  const setDigit = (index: number, value: string) => {
    const next = [...digits]
    next[index] = value
    setDigits(next)
    return next
  }

  const onChange = (index: number, raw: string) => {
    const only = raw.replace(/\D/g, '')
    if (!only) return setDigit(index, '')

    // Вставка кода целиком: раскидываем цифры по полям, а не пихаем всё в одно.
    if (only.length > 1) {
      const next = [...digits]
      for (let i = 0; i < only.length && index + i < LENGTH; i++) next[index + i] = only[i]
      setDigits(next)
      const filled = Math.min(index + only.length, LENGTH - 1)
      inputs.current[filled]?.focus()
      if (next.join('').length === LENGTH) void submit(next.join(''))
      return
    }

    const next = setDigit(index, only)
    if (index < LENGTH - 1) inputs.current[index + 1]?.focus()
    // Последняя цифра — отправляем сразу, не заставляя тянуться к кнопке.
    if (next.join('').length === LENGTH) void submit(next.join(''))
  }

  const onKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace в пустом поле возвращает к предыдущему — иначе там застреваешь.
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      e.preventDefault()
      setDigit(index - 1, '')
      inputs.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < LENGTH - 1) inputs.current[index + 1]?.focus()
  }

  return (
    <AuthLayout title="Подтверждение">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit(code)
        }}
        className="flex flex-col gap-5"
      >
        <p className="m-0 text-sm leading-[1.5] text-white/60">
          Мы отправили 4-значный код на{' '}
          <span className="font-semibold text-bone">{state.email}</span>. Введите его ниже.
        </p>

        <FormError message={error} />
        {notice && (
          <div className="rounded-xl border border-gold/30 bg-gold/[.08] px-4 py-2.5 text-[13px] text-white/75">
            {notice}
          </div>
        )}

        <div className="flex justify-center gap-2 min-[360px]:gap-3">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el
              }}
              value={d}
              onChange={(e) => onChange(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              onFocus={(e) => e.target.select()}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              aria-label={`Цифра ${i + 1} из ${LENGTH}`}
              disabled={busy}
              className={`font-display h-16 w-full max-w-[62px] rounded-[14px] border-2 bg-field text-center text-[26px] font-bold text-bone outline-none transition-colors focus:border-gold disabled:opacity-50 min-[360px]:h-[72px] min-[360px]:text-[30px] ${
                d ? 'border-gold/60' : 'border-white/[.12]'
              }`}
            />
          ))}
        </div>

        <button type="submit" disabled={busy || code.length !== LENGTH} className={submitClass}>
          {busy ? 'Проверяем…' : 'Подтвердить'}
        </button>
      </form>

      <div className="mt-5 text-center text-[13px] text-white/55">
        Код не пришёл?{' '}
        {cooldown > 0 ? (
          <span className="text-white/40">Отправить повторно через {cooldown} с</span>
        ) : (
          <button
            type="button"
            onClick={() => void resend()}
            disabled={resending}
            className="cursor-pointer border-none bg-transparent p-0 text-[13px] font-semibold text-gold disabled:opacity-50"
          >
            {resending ? 'Отправляем…' : 'Отправить код повторно'}
          </button>
        )}
      </div>
    </AuthLayout>
  )
}
