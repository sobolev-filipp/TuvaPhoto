import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  /** Ширина окна, px. */
  width?: number
}

/** Модальное окно: затемнение, Escape, клик по фону, блокировка прокрутки. */
export function Modal({ title, onClose, children, width = 460 }: ModalProps) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="animate-fade-up fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(6,6,8,.72)] p-4 backdrop-blur-[6px]"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width: '100%', maxWidth: width }}
        className="max-h-[90vh] overflow-y-auto rounded-[22px] border border-white/[.12] bg-surface-2 p-7 shadow-[0_22px_48px_rgba(0,0,0,.5)]"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="font-display m-0 text-xl leading-tight font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-white/[.16] text-sm text-white/60 hover:text-bone"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
