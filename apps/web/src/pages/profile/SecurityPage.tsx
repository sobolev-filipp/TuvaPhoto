import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ProfileSubLayout } from './ProfileSubLayout'
import { ApiError, authApi, type ApiSession } from '@/lib/api'
import { Field, FormError, submitClass } from '@/components/auth/AuthBits'
import { Toast, useToast } from '@/components/Toast'

const MIN_PASSWORD = 8

/** «Chrome на Windows» вместо простыни user-agent. */
function describeDevice(ua: string | null): string {
  if (!ua) return 'Неизвестное устройство'
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /YaBrowser/.test(ua) ? 'Яндекс.Браузер'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Браузер'
  const os =
    /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : ''
  return os ? `${browser} на ${os}` : browser
}

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

function ChangePassword({ onDone }: { onDone: (msg: string) => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const tooShort = next.length > 0 && next.length < MIN_PASSWORD
  const mismatch = confirm.length > 0 && confirm !== next
  const canSubmit = current.length > 0 && next.length >= MIN_PASSWORD && confirm === next

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setBusy(true)
    try {
      await authApi.changePassword({ currentPassword: current, newPassword: next })
      setCurrent('')
      setNext('')
      setConfirm('')
      onDone('Пароль изменён. Другие устройства разлогинены.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сменить пароль')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-10">
      <h2 className="font-display m-0 mb-2 text-xl font-bold">Смена пароля</h2>
      <p className="m-0 mb-5 text-sm leading-relaxed text-white/55">
        После смены пароля вход на других устройствах сбросится.
      </p>
      <form onSubmit={submit} className="flex max-w-[420px] flex-col gap-[13px]">
        <FormError message={error} />
        <Field
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="Текущий пароль"
          autoComplete="current-password"
          required
        />
        <div>
          <Field
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
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
          {busy ? 'Сохраняем…' : 'Сменить пароль'}
        </button>
      </form>
    </section>
  )
}

function Sessions({ onToast }: { onToast: (msg: string) => void }) {
  const qc = useQueryClient()
  const { data: sessions, isLoading, error } = useQuery({
    queryKey: ['sessions'],
    queryFn: authApi.sessions,
  })

  const revoke = useMutation({
    mutationFn: authApi.revokeSession,
    onSuccess: () => {
      onToast('Сессия завершена')
      void qc.invalidateQueries({ queryKey: ['sessions'] })
    },
    onError: () => onToast('Не удалось завершить сессию'),
  })

  const revokeOthers = useMutation({
    mutationFn: authApi.revokeOthers,
    onSuccess: ({ revoked }) => {
      onToast(revoked > 0 ? `Завершено сессий: ${revoked}` : 'Других сессий не было')
      void qc.invalidateQueries({ queryKey: ['sessions'] })
    },
  })

  const others = sessions?.filter((s: ApiSession) => !s.current).length ?? 0

  return (
    <section>
      <h2 className="font-display m-0 mb-2 text-xl font-bold">Активные сессии</h2>
      <p className="m-0 mb-5 max-w-[520px] text-sm leading-relaxed text-white/55">
        Устройства, на которых выполнен вход. Видите незнакомое — завершите сессию и смените пароль.
      </p>

      {isLoading && <div className="text-sm text-white/45">Загружаем…</div>}
      {error && <div className="text-sm text-red-300">Не удалось загрузить список сессий</div>}

      <div className="flex flex-col gap-3">
        {sessions?.map((s: ApiSession) => (
          <div
            key={s.id}
            className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 ${
              s.current ? 'border-gold/40 bg-gold/[.06]' : 'border-white/[.09] bg-surface-2'
            }`}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold">{describeDevice(s.userAgent)}</span>
                {s.current && (
                  <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-gold uppercase">
                    Это устройство
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-xs text-white/45">
                {s.ip ?? 'IP неизвестен'} · вход {formatDate(s.createdAt)}
              </div>
            </div>
            {!s.current && (
              <button
                type="button"
                onClick={() => revoke.mutate(s.id)}
                disabled={revoke.isPending}
                className="rounded-full border border-white/20 px-4 py-2.5 text-[13px] font-semibold text-white/70 transition-colors hover:border-red-400/60 hover:text-red-300 disabled:opacity-50"
              >
                Завершить
              </button>
            )}
          </div>
        ))}
      </div>

      {others > 0 && (
        <button
          type="button"
          onClick={() => revokeOthers.mutate()}
          disabled={revokeOthers.isPending}
          className="mt-6 rounded-full border border-white/20 px-5 py-3 text-[13px] font-semibold text-white/70 transition-colors hover:border-red-400/60 hover:text-red-300 disabled:opacity-50"
        >
          Завершить все, кроме текущей ({others})
        </button>
      )}
    </section>
  )
}

export function SecurityPage() {
  const { toast, show } = useToast()
  return (
    <ProfileSubLayout title="Безопасность">
      <ChangePassword onDone={show} />
      <div className="mb-10 h-px bg-white/[.08]" />
      <Sessions onToast={show} />
      <Toast toast={toast} />
    </ProfileSubLayout>
  )
}
