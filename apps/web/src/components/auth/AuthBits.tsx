import type { InputHTMLAttributes } from 'react'
import { useQuery } from '@tanstack/react-query'
import { authApi, oauthStartUrl } from '@/lib/api'

export const inputClass =
  'w-full rounded-[11px] border border-white/[.12] bg-field px-[15px] py-3.5 text-sm text-bone outline-none transition-colors placeholder:text-white/30 focus:border-gold disabled:opacity-50'

export const submitClass =
  'mt-1 w-full cursor-pointer rounded-xl border-none bg-gold p-[15px] text-[15px] font-bold text-on-gold transition-colors hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-50'

export function Field(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} />
}

/** Сообщение об ошибке от сервера. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] leading-relaxed text-red-300"
    >
      {message}
    </div>
  )
}

/** Обязательный чекбокс согласия по 152-ФЗ. */
export function ConsentCheckbox({
  checked,
  onChange,
  withOffer = false,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  withOffer?: boolean
}) {
  return (
    <label className="mt-1 flex cursor-pointer items-start gap-2.5 text-xs leading-[1.5] text-white/60">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 flex-none cursor-pointer accent-[#E4B45C]"
      />
      <span>
        {withOffer ? 'Я принимаю условия оферты и даю' : 'Я даю'} согласие на обработку персональных
        данных согласно{' '}
        <a href="/privacy" target="_blank" rel="noreferrer">
          Политике конфиденциальности
        </a>{' '}
        и ФЗ-152 «О персональных данных».
      </span>
    </label>
  )
}

const providerLabel: Record<string, string> = { yandex: 'Я', vk: 'VK' }

/**
 * Соцвход. Список провайдеров приходит с сервера — он отдаёт только те, для
 * которых заданы ключи. Пока ни один не настроен, блок не показываем вовсе:
 * незачем рисовать «войти через» без единой рабочей кнопки.
 *
 * Клик — это полная навигация (window.location), а не fetch: провайдер
 * ответит редиректом на свою страницу входа, через XHR это не пройдёт.
 */
export function SocialAuth() {
  const { data: providers } = useQuery({
    queryKey: ['oauth-providers'],
    queryFn: authApi.oauthProviders,
    staleTime: 5 * 60 * 1000,
  })

  if (!providers || providers.length === 0) return null

  return (
    <>
      <div className="my-[26px] mb-5 flex items-center gap-3.5">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs text-white/40">или войти через</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>
      <div className="flex gap-2.5">
        {providers.map((p) => (
          <a
            key={p.key}
            href={oauthStartUrl(p.key)}
            className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-surface-2 text-sm font-bold text-bone transition-colors hover:border-gold hover:text-bone"
          >
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-white/10 text-xs font-extrabold">
              {providerLabel[p.key] ?? p.name.slice(0, 2)}
            </span>
            <span>{p.name}</span>
          </a>
        ))}
      </div>
    </>
  )
}
