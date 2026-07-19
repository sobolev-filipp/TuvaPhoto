import type { ReactNode } from 'react'
import { Photo } from '../Photo'

/** Сплит-экран: слева атмосферное фото, справа форма. На мобильном фото скрыто. */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-74px)] items-stretch animate-fade-up">
      <div className="relative hidden min-w-0 flex-1 overflow-hidden min-[821px]:block">
        <Photo src={null} alt="" placeholder="Атмосферное фото выпускников" loading="eager" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(0deg,rgba(11,11,14,.92),rgba(11,11,14,.35) 60%,rgba(11,11,14,.5))',
          }}
        />
        <div className="pointer-events-none absolute right-14 bottom-14 left-14">
          <div className="font-display max-w-[440px] text-[34px] leading-[1.15] font-extrabold">
            Ваши альбомы всегда под рукой
          </div>
          <div className="mt-3.5 max-w-[400px] text-[15px] text-white/65">
            Сохраняйте варианты в конструкторе, отслеживайте заказы и историю съёмок в личном
            кабинете.
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center border-l border-white/[.06] bg-surface px-4 py-8 sm:px-6 min-[821px]:w-[520px] min-[821px]:p-10">
        <div className="w-full max-w-[360px]">
          <h1 className="font-display m-0 mb-[26px] text-[26px] leading-[1.1] font-bold min-[420px]:text-[28px]">
            {title}
          </h1>
          {children}
        </div>
      </div>
    </div>
  )
}
