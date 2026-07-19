import { useAbout } from '@/domain/useAbout'

/** Плавающая кнопка звонка — правый нижний угол, пульсирует. Номер — владельца. */
export function FloatingCall() {
  const { data: about } = useAbout()

  // Нет телефона — нет кнопки: показывать нерабочий звонок незачем.
  if (!about?.phoneHref) return null

  return (
    <a
      href={about.phoneHref}
      aria-label={`Позвонить фотографу: ${about.phone}`}
      title={`Позвонить: ${about.phone}`}
      className="animate-float-pulse fixed right-5 bottom-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-on-gold transition-colors hover:bg-gold-hover hover:text-on-gold"
    >
      <svg
        width="22"
        height="22"
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
    </a>
  )
}
