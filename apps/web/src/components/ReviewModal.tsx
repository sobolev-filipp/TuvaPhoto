import { useState } from 'react'
import { Modal } from './Modal'
import type { Review } from '@/domain/types'

interface ReviewModalProps {
  onClose: () => void
  onSubmit: (review: Review) => void
}

export const fieldClass =
  'w-full rounded-xl border border-white/[.12] bg-field px-4 py-3.5 text-sm text-bone outline-none transition-colors placeholder:text-white/30 focus:border-gold'

export function ReviewModal({ onClose, onSubmit }: ReviewModalProps) {
  const [rating, setRating] = useState(5)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [text, setText] = useState('')
  const [consent, setConsent] = useState(false)

  const canSubmit = name.trim().length > 1 && text.trim().length > 4 && consent

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit({
      id: crypto.randomUUID(),
      name: name.trim(),
      role: role.trim() || 'Клиент',
      rating,
      text: text.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
    })
  }

  return (
    <Modal title="Оставить отзыв" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <div className="mb-2 text-[13px] font-semibold text-white/55">Оценка</div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} из 5`}
                aria-pressed={rating === n}
                className={`cursor-pointer border-none bg-transparent p-0 text-2xl transition-colors ${
                  n <= rating ? 'text-gold' : 'text-white/20 hover:text-white/40'
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-white/55">Имя</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Как вас зовут"
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-white/55">Кто вы</span>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Например: мама выпускника, школа №2"
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-white/55">Отзыв</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            rows={4}
            placeholder="Расскажите, как всё прошло"
            className={`${fieldClass} resize-y`}
          />
        </label>

        <label className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-white/55">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
            className="mt-0.5 h-4 w-4 flex-none accent-[#E4B45C]"
          />
          <span>
            Я согласен на обработку персональных данных и публикацию отзыва на сайте.
          </span>
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-2 rounded-full bg-gold px-6 py-3.5 text-sm font-bold text-on-gold transition-colors hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Отправить отзыв
        </button>
      </form>
    </Modal>
  )
}
