import { useCallback, useEffect, useRef, useState } from 'react'

const TOAST_MS = 3200

export function useToast() {
  const [toast, setToast] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((message: string) => {
    setToast(message)
    if (timer.current) clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), TOAST_MS)
  }, [])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return { toast, show }
}

/** Тост: снизу по центру, автоскрытие ~3.2s. */
export function Toast({ toast }: { toast: string | null }) {
  if (!toast) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-fade-up fixed bottom-24 left-1/2 z-[90] -translate-x-1/2 rounded-full border border-gold/30 bg-[rgba(20,18,16,.98)] px-6 py-3.5 text-sm font-semibold shadow-[0_22px_48px_rgba(0,0,0,.5)] backdrop-blur-[18px]"
    >
      {toast}
    </div>
  )
}
