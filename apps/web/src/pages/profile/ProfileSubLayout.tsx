import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** Общий каркас подстраниц профиля: «назад», заголовок, контент. */
export function ProfileSubLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="animate-fade-up mx-auto max-w-[720px] px-4 pt-[70px] pb-[100px] md:px-10">
      <Link to="/profile" className="mb-6 inline-block text-sm font-semibold text-white/60 hover:text-gold">
        ← Личный кабинет
      </Link>
      <h1 className="font-display m-0 mb-8 text-[28px] leading-[1.05] font-extrabold md:text-[38px]">
        {title}
      </h1>
      {children}
    </div>
  )
}
