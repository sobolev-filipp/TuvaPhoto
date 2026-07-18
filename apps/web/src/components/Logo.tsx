/**
 * Монумент — знак бренда. Цвет наследуется от родителя (currentColor).
 * Ширина считается из высоты по пропорции viewBox (40:66), чтобы знак
 * нельзя было случайно сплющить.
 */
export function LogoMark({ className = '', height = 31 }: { className?: string; height?: number }) {
  return (
    <svg
      width={(height * 40) / 66}
      height={height}
      viewBox="0 0 40 66"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path d="M18.5 38 L20 5 L21.5 38 Z" />
      <circle cx="20" cy="3.4" r="2" />
      <circle cx="20" cy="45" r="7.6" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="M12.6 47.5 c-3.2 .5 -4.9 3 -5.1 6.6 l2.9 0 c.2 -2.8 1.2 -4.3 3.2 -5.1 Z" />
      <path d="M27.4 47.5 c3.2 .5 4.9 3 5.1 6.6 l-2.9 0 c-.2 -2.8 -1.2 -4.3 -3.2 -5.1 Z" />
      <path d="M9.5 54.5 h21 l-2.7 8.5 h-15.6 Z" />
    </svg>
  )
}

/** Знак + «ТуваФото». `size` — кегль словесной части. */
export function Logo({ size = 19 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-8 w-6 items-center justify-center text-gold">
        <LogoMark />
      </span>
      <span
        className="font-display leading-none font-extrabold tracking-[.01em]"
        style={{ fontSize: size }}
      >
        Тува<span className="text-gold">Фото</span>
      </span>
    </span>
  )
}
