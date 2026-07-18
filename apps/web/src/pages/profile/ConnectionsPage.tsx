import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ProfileSubLayout } from './ProfileSubLayout'
import { ApiError, authApi, type ApiConnection } from '@/lib/api'
import { Toast, useToast } from '@/components/Toast'

const providerLabel: Record<string, string> = { yandex: 'Я', vk: 'VK' }

const oauthErrorText: Record<string, string> = {
  already_linked: 'Этот аккаунт уже привязан к другому профилю.',
  state: 'Сессия привязки устарела. Попробуйте ещё раз.',
  exchange: 'Не удалось получить данные от провайдера.',
  provider: 'Провайдер отклонил привязку.',
}

/**
 * Привязка соцаккаунтов к текущему профилю.
 *
 * Кнопка «Привязать» стучится на POST /link (с токеном), получает URL и уводит
 * браузер к провайдеру. Полная навигация нужна потому, что провайдер отвечает
 * своей страницей входа — через fetch это не пройдёт.
 */
export function ConnectionsPage() {
  const qc = useQueryClient()
  const { toast, show } = useToast()
  const [params, setParams] = useSearchParams()

  // Вернулись с провайдера — покажем результат и почистим URL.
  useEffect(() => {
    const linked = params.get('linked')
    const err = params.get('oauth_error')
    if (linked) {
      show('Аккаунт привязан')
      void qc.invalidateQueries({ queryKey: ['connections'] })
    } else if (err) {
      show(oauthErrorText[err] ?? 'Не удалось привязать аккаунт')
    }
    if (linked || err) setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: connections, isLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: authApi.connections,
  })

  const link = useMutation({
    mutationFn: authApi.linkOAuth,
    onSuccess: ({ url }) => {
      // Уводим к провайдеру.
      window.location.href = url
    },
    onError: () => show('Не удалось начать привязку'),
  })

  const unlink = useMutation({
    mutationFn: authApi.unlinkOAuth,
    onSuccess: () => {
      show('Аккаунт отвязан')
      void qc.invalidateQueries({ queryKey: ['connections'] })
    },
    onError: (e) => show(e instanceof ApiError ? e.message : 'Не удалось отвязать'),
  })

  return (
    <ProfileSubLayout title="Подключённые аккаунты">
      <p className="m-0 mb-6 max-w-[520px] text-sm leading-relaxed text-white/55">
        Привяжите Яндекс или VK, чтобы входить в один клик, без пароля.
      </p>

      {isLoading && <div className="text-sm text-white/45">Загружаем…</div>}

      {connections && connections.length === 0 && (
        <div className="rounded-2xl border border-white/[.09] bg-surface-2 p-5 text-sm text-white/55">
          Вход через соцсети пока не настроен на сайте.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {connections?.map((c: ApiConnection) => (
          <div
            key={c.key}
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[.09] bg-surface-2 p-5"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-white/10 text-sm font-extrabold">
                {providerLabel[c.key] ?? c.name.slice(0, 2)}
              </span>
              <div>
                <div className="text-sm font-bold">{c.name}</div>
                <div className="mt-0.5 text-xs text-white/45">
                  {c.linked ? 'Привязан' : 'Не привязан'}
                </div>
              </div>
            </div>
            {c.linked ? (
              <button
                type="button"
                onClick={() => unlink.mutate(c.key)}
                disabled={unlink.isPending}
                className="rounded-full border border-white/20 px-4 py-2.5 text-[13px] font-semibold text-white/70 transition-colors hover:border-red-400/60 hover:text-red-300 disabled:opacity-50"
              >
                Отвязать
              </button>
            ) : (
              <button
                type="button"
                onClick={() => link.mutate(c.key)}
                disabled={link.isPending}
                className="rounded-full bg-gold px-5 py-2.5 text-[13px] font-bold text-on-gold transition-colors hover:bg-gold-hover disabled:opacity-50"
              >
                Привязать
              </button>
            )}
          </div>
        ))}
      </div>

      <Toast toast={toast} />
    </ProfileSubLayout>
  )
}
