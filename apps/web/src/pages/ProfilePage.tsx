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
      className="flex items-center justify-between gap-4 rounded-2xl border border-white/[.09] bg-surface-2 p-5 transition-colors hover:border-gold/40 hover:text-bone"
    >
      <div>
        <div className="font-display text-[15px] font-bold">{title}</div>
        <div className="mt-1 text-sm text-white/55">{desc}</div>
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

  return (
    <div className="animate-fade-up mx-auto max-w-[860px] px-4 pt-[70px] pb-[100px] md:px-10">
      <div className="mb-3.5 font-mono text-[13px] font-bold tracking-[.14em] text-gold uppercase">
        Личный кабинет
      </div>
      <h1 className="font-display m-0 mb-10 text-[32px] leading-[1.03] font-extrabold md:text-[48px]">
        {user.name}
      </h1>

      {/* Данные профиля */}
      <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-white/[.09] bg-surface-2 p-6">
        <div className="flex justify-between gap-4 border-b border-white/[.07] pb-4">
          <span className="text-white/50">Имя</span>
          <span className="font-semibold">{user.name}</span>
        </div>
        <div className="flex justify-between gap-4 border-b border-white/[.07] pb-4">
          <span className="text-white/50">Email</span>
          <span className="font-semibold">{user.email}</span>
        </div>
        {user.phone && (
          <div className="flex justify-between gap-4 border-b border-white/[.07] pb-4">
            <span className="text-white/50">Телефон</span>
            <span className="font-semibold">{formatPhone(user.phone)}</span>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <span className="text-white/50">Роль</span>
          <span className="font-semibold">{user.role === 'OWNER' ? 'Владелец' : 'Клиент'}</span>
        </div>
      </div>

      {/* Разделы — заходят по клику, а не показаны инлайн */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SectionLink
          to="/profile/security"
          title="Безопасность"
          desc="Смена пароля и активные сессии"
        />
        <SectionLink
          to="/profile/connections"
          title="Подключённые аккаунты"
          desc="Вход через Яндекс и VK"
        />
        <SectionLink
          to="/profile/albums"
          title="Мои альбомы"
          desc="Сохранённые варианты и заказы"
        />
        {user.role === 'OWNER' && (
          <SectionLink to="/admin" title="Админ-панель" desc="Управление сайтом" />
        )}
      </div>

      <button
        type="button"
        onClick={() => void logout().then(() => navigate('/'))}
        className="mt-8 cursor-pointer rounded-full border border-white/15 bg-transparent px-5 py-3 text-sm font-semibold text-white/60 transition-colors hover:border-red-400/60 hover:text-red-300"
      >
        Выйти
      </button>
    </div>
  )
}
