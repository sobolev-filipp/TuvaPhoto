import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  dismissInstallBannerForever,
  shouldShowInstallBanner,
  snoozeInstallBanner,
  useInstall,
} from './useInstall'

/** Плашка появляется чуть позже загрузки, чтобы не спорить с первым экраном. */
const APPEAR_DELAY_MS = 2500

export function InstallBanner() {
  const { installed, canPrompt, needsManualInstall, promptInstall } = useInstall()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (installed) return
    // Пока браузер не дал событие и это не iOS, ставить нечего — молчим.
    if (!canPrompt && !needsManualInstall) return
    if (!shouldShowInstallBanner()) return

    const t = setTimeout(() => {
      // Условие могло измениться, пока ждали (например, установили в другой вкладке).
      if (shouldShowInstallBanner()) setShow(true)
    }, APPEAR_DELAY_MS)
    return () => clearTimeout(t)
  }, [installed, canPrompt, needsManualInstall])

  if (!show || installed) return null

  const close = () => {
    snoozeInstallBanner()
    setShow(false)
  }

  const never = () => {
    dismissInstallBannerForever()
    setShow(false)
  }

  const install = async () => {
    const outcome = await promptInstall()
    // Отказ — не повод спрашивать снова сегодня.
    snoozeInstallBanner()
    if (outcome !== 'dismissed') setShow(false)
    else setShow(false)
  }

  return (
    <div
      role="dialog"
      aria-label="Установка приложения ТуваФото"
      className="animate-fade-up fixed inset-x-4 bottom-4 z-[75] mx-auto max-w-[440px] rounded-2xl border border-white/[.12] bg-[rgba(20,20,24,.98)] p-5 shadow-[0_22px_48px_rgba(0,0,0,.5)] backdrop-blur-[18px]"
    >
      <button
        type="button"
        onClick={close}
        aria-label="Скрыть"
        className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:text-bone"
      >
        ✕
      </button>

      <div className="flex items-start gap-3">
        <img src="/icons/icon-192.png" alt="" className="h-11 w-11 flex-none rounded-xl" />
        <div className="min-w-0 pr-6">
          <div className="font-display text-[15px] font-bold">Установите приложение</div>
          <p className="mt-1 mb-0 text-[13px] leading-relaxed text-white/60">
            {needsManualInstall
              ? 'Откройте «Поделиться» и выберите «На экран „Домой“» — альбомы будут открываться в один тап и работать без интернета.'
              : 'Альбомы будут открываться в один тап, с иконкой на экране и работой без интернета.'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={never}
          className="mr-auto cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-white/35 hover:text-white/60"
        >
          Больше не показывать
        </button>
        {canPrompt ? (
          <button
            type="button"
            onClick={() => void install()}
            className="rounded-full bg-gold px-5 py-2.5 text-[13px] font-bold text-on-gold transition-colors hover:bg-gold-hover"
          >
            Установить
          </button>
        ) : (
          <Link
            to="/install"
            onClick={close}
            className="rounded-full bg-gold px-5 py-2.5 text-[13px] font-bold text-on-gold hover:bg-gold-hover hover:text-on-gold"
          >
            Как установить
          </Link>
        )}
      </div>
    </div>
  )
}
