import { Link } from 'react-router-dom'
import { LogoMark } from './Logo'
import { about, CONTACT_EMAIL, CONTACT_PHONE, CONTACT_PHONE_HREF } from '@/domain/demoData'

/** Значки соцсетей появляются только для заполненных в админке ссылок. */
const socials = [
  {
    key: 'tg',
    href: about.tg,
    label: 'Telegram',
    icon: (
      <path d="M21.94 4.6 18.6 20.3c-.25 1.11-.9 1.39-1.83.87l-5.05-3.72-2.44 2.35c-.27.27-.5.5-1.02.5l.36-5.15L18 6.9c.4-.36-.09-.56-.63-.2L6.32 13.6l-4.98-1.56c-1.08-.34-1.1-1.08.23-1.6L20.54 3.1c.9-.33 1.69.2 1.4 1.5Z" />
    ),
  },
  {
    key: 'vk',
    href: about.vk,
    label: 'ВКонтакте',
    icon: (
      <path d="M13.16 17.5c-5.47 0-8.86-3.79-9-10.08h2.75c.1 4.62 2.19 6.58 3.79 6.98V7.42h2.62v3.96c1.55-.17 3.18-1.98 3.73-3.96h2.58c-.42 2.44-2.19 4.25-3.44 5 1.25.6 3.27 2.19 4.05 5.08h-2.85c-.6-1.9-2.09-3.37-4.07-3.57v3.57h-.16Z" />
    ),
  },
].filter((s) => s.href)

export function Footer() {
  return (
    <footer className="border-t border-white/[.07] bg-surface">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-16 md:grid-cols-[1.4fr_1fr] md:px-10">
        <div>
          <span className="flex items-center gap-2.5">
            <span className="flex h-8 w-6 items-center justify-center text-gold">
              <LogoMark />
            </span>
            <span className="font-display text-lg leading-none font-extrabold">
              Тува<span className="text-gold">Фото</span>
            </span>
          </span>
          <p className="mt-4 max-w-[380px] text-sm leading-relaxed text-white/55">
            Авторские выпускные фотоальбомы для школ и детских садов Республики Тыва. Съёмка, вёрстка и
            сборка книги — своими руками.
          </p>
        </div>

        <div>
          <div className="mb-4 font-mono text-[11px] tracking-[.14em] text-gold uppercase">Контакты</div>
          <div className="flex flex-col gap-2.5 text-sm">
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-bone hover:text-gold">
              {CONTACT_EMAIL}
            </a>
            <a href={CONTACT_PHONE_HREF} className="text-bone hover:text-gold">
              {CONTACT_PHONE}
            </a>
          </div>

          {socials.length > 0 && (
            <>
              <div className="mt-7 mb-3 font-mono text-[11px] tracking-[.14em] text-gold uppercase">
                Мы в соцсетях
              </div>
              <div className="flex gap-2.5">
                {socials.map((s) => (
                  <a
                    key={s.key}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    title={s.label}
                    className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-white/[.14] bg-white/[.04] text-white/60 transition-colors hover:border-gold hover:bg-gold/[.12] hover:text-gold"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      {s.icon}
                    </svg>
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-white/[.07]">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-white/40 md:px-10">
          <span>© 2026 ТуваФото</span>
          <Link to="/privacy" className="text-white/40 hover:text-gold">
            Политика обработки персональных данных
          </Link>
        </div>
      </div>
    </footer>
  )
}
