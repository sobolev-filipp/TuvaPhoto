import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { formatPhone } from '@/lib/phone'

function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

/** Карточка-кнопка, ведущая в отдельный раздел профиля. */
function SectionLink({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 rounded-2xl border border-white/[.09] bg-surface-2 p-4 transition-colors hover:border-gold/40 hover:text-bone sm:p-5"
    >
      <div className="min-w-0">
        <div className="font-display text-[15px] font-bold">{title}</div>
        <div className="mt-1 text-[13px] text-white/55 sm:text-sm">{desc}</div>
      </div>
      <span className="flex-none text-white/40">
        <ChevronRight />
      </span>
    </Link>
  )
}

export function ProfilePage() {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const navigate = useNavigate()

  if (!user) return null

  const initial = user.name.charAt(0).toUpperCase()

  return (
    <div className="animate-fade-up mx-auto max-w-[860px] px-4 pt-[60px] pb-[100px] sm:px-6 md:px-10 md:pt-[70px]">
      <div className="mb-6 font-mono text-[12px] font-bold tracking-[.14em] text-gold uppercase sm:text-[13px]">
        Личный кабинет
      </div>

      {/* Шапка: аватар и имя всегда на одной строке (включая мобильную).
          Имя показываем один раз, роль не выводим. */}
      <div className="mb-8 flex items-center gap-3.5 rounded-2xl border border-white/[.09] bg-surface-2 p-4 sm:gap-4 sm:p-6">
        <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full border border-gold/50 bg-[linear-gradient(135deg,#2a2a30,#161619)] text-[24px] font-bold text-gold sm:h-16 sm:w-16 sm:text-[26px]">
          {initial}
        </span>
        <div className="min-w-0">
          <h1 className="font-display m-0 text-[20px] leading-tight font-extrabold break-words min-[420px]:text-[24px] sm:text-[28px]">
            {user.name}
          </h1>
          <div className="mt-1.5 flex flex-col gap-0.5 text-[13px] text-white/60 sm:text-sm">
            <a href={`mailto:${user.email}`} className="break-all text-white/70 hover:text-gold">
              {user.email}
            </a>
            {user.phone && <span>{formatPhone(user.phone)}</span>}
          </div>
        </div>
      </div>

      {/* Разделы — заходят по клику, а не показаны инлайн */}
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <SectionLink to="/profile/security" title="Безопасность" desc="Смена пароля и активные сессии" />
        <SectionLink
          to="/profile/connections"
          title="Подключённые аккаунты"
          desc="Вход через Яндекс и VK"
        />
        <SectionLink to="/profile/albums" title="Мои альбомы" desc="Сохранённые варианты и заказы" />
        {user.role === 'OWNER' && (
          <SectionLink to="/admin" title="Админ-панель" desc="Управление сайтом" />
        )}
      </div>

      <button
        type="button"
        onClick={() => void logout().then(() => navigate('/'))}
        className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/[.08] px-5 py-3.5 text-[15px] font-semibold text-red-300 transition-colors hover:border-red-400/60 hover:bg-red-500/15 sm:w-auto"
      >
        <svg
          width="18"
          height="18"
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
    </div>
  )
}
