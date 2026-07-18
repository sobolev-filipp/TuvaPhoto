import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Плашка «вышло обновление» с кнопкой обновить.
 *
 * registerType: 'prompt' в vite.config — новый service worker ждёт в состоянии
 * waiting и не активируется сам. Пока пользователь не нажал кнопку, он
 * продолжает работать на старой версии, и открытые вкладки не перезагружаются
 * под ним. updateServiceWorker(true) активирует нового и перезагружает страницу.
 */
const CHECK_INTERVAL_MS = 60 * 60 * 1000 // раз в час

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // Долгие сессии (админка открыта весь день) иначе не узнают об обновлении.
      setInterval(() => {
        registration.update().catch(() => {
          // Сеть недоступна — проверим на следующем тике.
        })
      }, CHECK_INTERVAL_MS)
    },
  })

  if (!needRefresh) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-fade-up fixed inset-x-4 bottom-4 z-[80] mx-auto max-w-[440px] rounded-2xl border border-gold/30 bg-[rgba(20,18,16,.98)] p-5 shadow-[0_22px_48px_rgba(0,0,0,.5)] backdrop-blur-[18px]"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gold/15 text-gold">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </span>
        <div className="min-w-0">
          <div className="font-display text-[15px] font-bold">Доступно обновление</div>
          <p className="mt-1 mb-0 text-[13px] leading-relaxed text-white/60">
            Вышла новая версия сайта. Обновите, чтобы работали свежие возможности.
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2.5">
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="rounded-full border border-white/20 px-4 py-2.5 text-[13px] font-semibold text-white/70 transition-colors hover:border-white/40 hover:text-bone"
        >
          Позже
        </button>
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="rounded-full bg-gold px-5 py-2.5 text-[13px] font-bold text-on-gold transition-colors hover:bg-gold-hover"
        >
          Обновить
        </button>
      </div>
    </div>
  )
}
