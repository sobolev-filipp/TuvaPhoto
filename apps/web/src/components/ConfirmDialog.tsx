import { Modal } from './Modal'

/**
 * Попап-подтверждение действия (замена нативных confirm/alert). Не закрывается
 * во время выполнения и показывает ошибку прямо в окне.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Удалить',
  danger = true,
  busy = false,
  error = null,
  onConfirm,
  onClose,
}: {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  busy?: boolean
  error?: string | null
  onConfirm: () => void
  onClose: () => void
}) {
  const confirmClass = danger
    ? 'rounded-full border border-red-400/40 bg-red-500/15 px-5 py-2.5 text-[14px] font-bold text-red-200 transition-colors hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-40'
    : 'rounded-full bg-gold px-5 py-2.5 text-[14px] font-bold text-on-gold transition-colors hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <Modal title={title} onClose={() => (busy ? undefined : onClose())}>
      <div className="flex flex-col gap-4">
        <p className="m-0 text-sm leading-relaxed text-white/65">{message}</p>
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
            {error}
          </div>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={onConfirm} disabled={busy} className={confirmClass}>
            {busy ? 'Выполняем…' : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full border border-white/15 px-5 py-2.5 text-[14px] font-semibold text-bone transition-colors hover:border-gold/50 hover:text-gold disabled:opacity-50"
          >
            Отмена
          </button>
        </div>
      </div>
    </Modal>
  )
}
