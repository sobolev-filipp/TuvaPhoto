/**
 * Замена прототипного `image-slot`: реальное фото или плейсхолдер с подписью.
 * Фото грузятся владельцем через админку, поэтому пустой слот — штатное
 * состояние витрины, а не ошибка.
 */
interface PhotoProps {
  src: string | null | undefined
  alt: string
  /** Подпись плейсхолдера, если фото ещё не загружено. */
  placeholder?: string
  className?: string
  loading?: 'lazy' | 'eager'
}

export function Photo({ src, alt, placeholder, className = '', loading = 'lazy' }: PhotoProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        className={`h-full w-full object-cover ${className}`}
      />
    )
  }

  return (
    <div
      role="img"
      aria-label={placeholder ?? alt}
      className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-[linear-gradient(135deg,#17171c,#0f0f13)] p-3 text-center ${className}`}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-gold/45"
        aria-hidden="true"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="10" r="1.5" />
        <path d="m21 15-4.5-4.5L9 18" />
      </svg>
      <span className="font-mono text-[9px] tracking-[.12em] text-white/35 uppercase">
        {placeholder ?? alt}
      </span>
    </div>
  )
}
