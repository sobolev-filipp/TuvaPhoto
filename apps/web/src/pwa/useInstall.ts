import { useCallback, useEffect, useState } from 'react'
import { readLocal, writeLocal } from '@/lib/storage'

/** Событие Chrome/Edge/Android; в стандартных типах его нет. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const SNOOZE_KEY = 'tuvafoto:install-snooze'
const DISMISSED_KEY = 'tuvafoto:install-dismissed'
const DAY_MS = 24 * 60 * 60 * 1000

/** Приложение уже установлено и открыто как отдельное окно. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari не поддерживает display-mode и ставит свой флаг.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

/**
 * Установка PWA.
 *
 * `canPrompt` — браузер дал нам отложенное событие и установку можно
 * запустить кнопкой. На iOS этого события не существует: там установка
 * только вручную через «Поделиться → На экран Домой», поэтому показываем
 * инструкцию (`needsManualInstall`).
 */
export function useInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      // Гасим встроенную мини-плашку — показываем свою в фирменном стиле.
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferred) return 'unavailable' as const
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    // Событие одноразовое: браузер выдаст новое только при следующем заходе.
    setDeferred(null)
    return outcome
  }, [deferred])

  return {
    installed,
    canPrompt: deferred !== null,
    needsManualInstall: !installed && !deferred && isIos(),
    promptInstall,
  }
}

/** Плашку показываем не чаще раза в сутки и никогда — после «больше не показывать». */
export function shouldShowInstallBanner(): boolean {
  if (isStandalone()) return false
  if (readLocal(DISMISSED_KEY, false)) return false
  const last = readLocal<number>(SNOOZE_KEY, 0)
  return Date.now() - last >= DAY_MS
}

export function snoozeInstallBanner(): void {
  writeLocal(SNOOZE_KEY, Date.now())
}

export function dismissInstallBannerForever(): void {
  writeLocal(DISMISSED_KEY, true)
}
