import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from './Logo'
import { useAbout } from '@/domain/useAbout'
import { useAuth } from '@/store/auth'

const links = [
  { to: '/', label: 'Главная', end: true },
  { to: '/catalog', label: 'Каталог' },
  { to: '/constructor', label: 'Конструктор' },
  { to: '/contacts', label: 'Контакты' },
]

function PhoneIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const { data: about } = useAbout()

  // Меню — модальный слой: закрываем при смене роута и блокируем прокрутку фона.
  useEffect(() => setMenuOpen(false), [pathname])
  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `cursor-pointer rounded-full border-none px-3.5 py-2 text-sm font-semibold transition-colors ${
      isActive ? 'bg-gold/15 text-gold' : 'bg-transparent text-bone hover:text-gold'
    }`

  const initial = user?.name.charAt(0).toUpperCase() ?? ''

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-white/[.07] bg-[rgba(11,11,14,.72)] backdrop-blur-[18px]">
        <div className="mx-auto flex h-[74px] max-w-[1240px] items-center justify-between gap-4 px-4 md:px-10">
          <Link to="/" aria-label="ТуваФото — на главную" className="text-bone hover:text-bone">
            <Logo />
          </Link>

          <div className="hidden items-center gap-1.5 min-[801px]:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={navLinkClass}>
                {l.label}
              </NavLink>
            ))}
          </div>

          <div className="hidden items-center gap-3 min-[801px]:flex">
            {about?.phoneHref && (
              <a
                href={about.phoneHref}
                className="flex items-center gap-2 text-sm font-semibold text-bone hover:text-bone"
              >
                <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/[.16] text-gold">
                  <PhoneIcon />
                </span>
                <span className="hidden opacity-85 min-[1121px]:inline">{about.phone}</span>
              </a>
            )}
            <Link
              to="/constructor"
              className="hidden rounded-full bg-gold px-[22px] py-3 text-sm font-bold text-on-gold transition-colors hover:bg-gold-hover hover:text-on-gold min-[981px]:inline-block"
            >
              Заказать альбом
            </Link>
            {user ? (
              <Link
                to="/profile"
                title="Личный кабинет"
                aria-label="Личный кабинет"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/50 bg-[linear-gradient(135deg,#2a2a30,#161619)] text-[15px] font-bold text-gold"
              >
                {initial}
              </Link>
            ) : (
              <Link
                to="/login"
                className="rounded-full border border-white/20 px-[18px] py-2.5 text-sm font-semibold text-bone transition-colors hover:border-gold hover:text-gold"
              >
                Войти
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={menuOpen}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-white/[.16] bg-white/5 text-xl text-bone min-[801px]:hidden"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <>
          {/* Открытое меню — поверх всего, включая cookie-баннер (z-70), иначе
              он перекрывал бы нижние кнопки меню. */}
          <div
            onClick={() => setMenuOpen(false)}
            className="animate-fade-up fixed inset-0 z-[71] bg-[rgba(6,6,8,.6)]"
          />
          <div className="animate-drawer-in fixed inset-y-0 right-0 z-[72] flex w-[320px] max-w-[86vw] flex-col overflow-y-auto border-l border-white/[.09] bg-[rgba(15,15,19,.99)] px-4 py-5 backdrop-blur-[18px]">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-lg leading-none font-extrabold">
                Тува<span className="text-gold">Фото</span>
              </span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Закрыть меню"
                className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-white/[.16] text-base text-bone"
              >
                ✕
              </button>
            </div>

            {/* Карточка пользователя ведёт в профиль; стрелка подсказывает клик. */}
            {user && (
              <Link
                to="/profile"
                className="mb-3 flex items-center gap-3 rounded-2xl border border-white/[.09] bg-white/[.03] p-3 transition-colors hover:border-gold/40 hover:bg-gold/[.06]"
              >
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-gold/50 bg-[linear-gradient(135deg,#2a2a30,#161619)] text-[17px] font-bold text-gold">
                  {initial}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-bone">{user.name}</span>
                  <span className="block text-xs text-gold">Личный кабинет</span>
                </span>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="flex-none text-white/40"
                  aria-hidden="true"
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </Link>
            )}

            <nav className="flex flex-col gap-0.5">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    `rounded-[10px] px-3 py-3 text-left text-[16px] font-semibold ${
                      isActive ? 'bg-gold/15 text-gold' : 'text-bone hover:bg-white/5'
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>

            <div className="my-3 h-px bg-white/[.08]" />

            <Link
              to="/constructor"
              className="rounded-xl bg-gold px-4 py-[14px] text-center text-[15px] font-bold text-on-gold hover:text-on-gold"
            >
              Заказать альбом
            </Link>
            {about?.phoneHref && (
              <a
                href={about.phoneHref}
                className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-white/[.16] bg-white/[.06] px-4 py-3 text-[15px] font-semibold text-bone hover:text-bone"
              >
                <span className="text-gold">
                  <PhoneIcon />
                </span>
                {about.phone}
              </a>
            )}

            {/* Распорка прижимает аккаунт-действия и админку к низу панели. */}
            <div className="flex-1" />

            {user ? (
              <>
                {/* Админ-панель — только владельцу. */}
                {user.role === 'OWNER' && (
                  <Link
                    to="/admin"
                    className="flex items-center justify-center gap-2 rounded-xl border border-gold/40 bg-gold/[.08] px-4 py-3 text-[15px] font-semibold text-gold transition-colors hover:bg-gold/15"
                  >
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                    </svg>
                    Админ-панель
                  </Link>
                )}

                {/* Выйти — в самом низу меню. */}
                <button
                  type="button"
                  onClick={() => void logout().then(() => navigate('/'))}
                  className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/[.08] px-4 py-3 text-[15px] font-semibold text-red-300 transition-colors hover:border-red-400/60 hover:bg-red-500/15"
                >
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="m16 17 5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                  Выйти
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="rounded-xl border border-white/20 px-4 py-3 text-center text-[15px] font-semibold text-bone hover:border-gold hover:text-gold"
              >
                Войти
              </Link>
            )}
          </div>
        </>
      )}
    </>
  )
}
