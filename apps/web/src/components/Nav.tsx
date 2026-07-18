import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from './Logo'
import { CONTACT_PHONE, CONTACT_PHONE_HREF } from '@/domain/demoData'
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

  const drawerBtn =
    'rounded-xl border border-white/20 bg-transparent px-4 py-3.5 text-[15px] font-semibold text-bone'

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-white/[.07] bg-[rgba(11,11,14,.72)] backdrop-blur-[18px]">
        <div className="mx-auto flex h-[74px] max-w-[1240px] items-center justify-between gap-6 px-4 md:px-10">
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
            <a
              href={CONTACT_PHONE_HREF}
              className="flex items-center gap-2 text-sm font-semibold text-bone hover:text-bone"
            >
              <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/[.16] text-gold">
                <PhoneIcon />
              </span>
              <span className="hidden opacity-85 min-[1121px]:inline">{CONTACT_PHONE}</span>
            </a>
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
                {user.name.charAt(0).toUpperCase()}
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
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[.16] bg-white/5 text-xl text-bone min-[801px]:hidden"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            className="animate-fade-up fixed inset-0 z-[59] bg-[rgba(6,6,8,.6)]"
          />
          <div className="animate-drawer-in fixed inset-y-0 right-0 z-[60] flex w-[300px] max-w-[82vw] flex-col gap-1.5 overflow-y-auto border-l border-white/[.09] bg-[rgba(15,15,19,.99)] px-[18px] py-[22px] backdrop-blur-[18px]">
            <div className="mb-3.5 flex items-center justify-between">
              <span className="font-display text-lg leading-none font-extrabold">
                Тува<span className="text-gold">Фото</span>
              </span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Закрыть меню"
                className="h-[38px] w-[38px] rounded-[10px] border border-white/[.16] text-base text-bone"
              >
                ✕
              </button>
            </div>

            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `rounded-[10px] px-3 py-[15px] text-left text-[17px] font-semibold ${
                    isActive ? 'bg-gold/15 text-gold' : 'text-bone hover:bg-white/5'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}

            <div className="my-2 h-px bg-white/[.08]" />

            <Link
              to="/constructor"
              className="rounded-xl bg-gold px-4 py-[15px] text-center text-[15px] font-bold text-on-gold hover:text-on-gold"
            >
              Заказать альбом
            </Link>
            <a
              href={CONTACT_PHONE_HREF}
              className="rounded-xl border border-white/[.16] bg-white/[.06] px-4 py-3.5 text-center text-[15px] font-semibold text-bone hover:text-bone"
            >
              Позвонить: {CONTACT_PHONE}
            </a>

            {user ? (
              <>
                <Link to="/profile" className={`${drawerBtn} text-center hover:text-bone`}>
                  Личный кабинет
                </Link>
                {user.role === 'OWNER' && (
                  <Link to="/admin" className={`${drawerBtn} text-center hover:text-bone`}>
                    Админ-панель
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    void logout().then(() => navigate('/'))
                  }}
                  className="cursor-pointer border-none bg-transparent p-3 text-sm font-semibold text-white/55"
                >
                  Выйти
                </button>
              </>
            ) : (
              <Link to="/login" className={`${drawerBtn} text-center hover:text-bone`}>
                Войти
              </Link>
            )}
          </div>
        </>
      )}
    </>
  )
}
