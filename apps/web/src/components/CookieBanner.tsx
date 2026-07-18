import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { readLocal, writeLocal } from '@/lib/storage'

const KEY = 'tuvafoto:cookie-choice'
export type CookieChoice = 'all' | 'necessary'

export const getCookieChoice = () => readLocal<CookieChoice | null>(KEY, null)

export function CookieBanner() {
  const [choice, setChoice] = useState<CookieChoice | null | 'loading'>('loading')

  useEffect(() => setChoice(getCookieChoice()), [])

  if (choice === 'loading' || choice !== null) return null

  const decide = (value: CookieChoice) => {
    writeLocal(KEY, value)
    setChoice(value)
  }

  return (
    <div
      role="dialog"
      aria-label="Использование cookie"
      className="animate-fade-up fixed inset-x-0 bottom-0 z-[70] border-t border-white/[.09] bg-[rgba(13,13,16,.97)] backdrop-blur-[18px]"
    >
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-4 py-5 md:px-10">
        <p className="m-0 max-w-[640px] text-[13px] leading-relaxed text-white/70">
          Мы используем cookie, чтобы сайт работал и чтобы понимать, какие альбомы вам интересны.
          Подробнее — в{' '}
          <Link to="/privacy" className="underline">
            политике обработки персональных данных
          </Link>
          .
        </p>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => decide('necessary')}
            className="rounded-full border border-white/20 px-5 py-3 text-[13px] font-semibold text-bone transition-colors hover:border-gold hover:text-gold"
          >
            Только необходимые
          </button>
          <button
            type="button"
            onClick={() => decide('all')}
            className="rounded-full bg-gold px-5 py-3 text-[13px] font-bold text-on-gold transition-colors hover:bg-gold-hover"
          >
            Принять все
          </button>
        </div>
      </div>
    </div>
  )
}
