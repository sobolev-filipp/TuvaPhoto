import { useId, useLayoutEffect, useRef } from 'react'
import { inputClass } from './AuthBits'

/**
 * Поле телефона с маской +7 (9xx) xxx-xx-xx.
 *
 * Наружу (в value/onChange) отдаём только цифры номера без кода страны — до
 * 10 знаков, начиная с 9. Маску рисуем при отображении. Так родитель хранит
 * чистое значение, а отправить на сервер можно и цифры, и отформатированный
 * вид — сервер всё равно нормализует.
 */
interface PhoneFieldProps {
  /** До 10 цифр номера (без +7), например "9233882707". */
  value: string
  onChange: (digits: string) => void
  required?: boolean
}

/** "9233882707" -> "+7 (923) 388-27-07", наращивая по мере ввода. */
function format(digits: string): string {
  if (!digits) return ''
  const a = digits.slice(0, 3)
  const b = digits.slice(3, 6)
  const c = digits.slice(6, 8)
  const d = digits.slice(8, 10)
  let out = `+7 (${a}`
  if (digits.length >= 3) out += ')'
  if (b) out += ` ${b}`
  if (c) out += `-${c}`
  if (d) out += `-${d}`
  return out
}

/** Позиция каретки ПОСЛЕ N-й цифры номера (первая цифра строки — код «7», её пропускаем). */
function caretAfterDigits(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0
  let numberDigits = 0
  let countrySkipped = false
  for (let i = 0; i < formatted.length; i++) {
    if (!/\d/.test(formatted[i])) continue
    if (!countrySkipped) {
      countrySkipped = true
      continue
    }
    numberDigits++
    if (numberDigits === digitCount) return i + 1
  }
  return formatted.length
}

export function PhoneField({ value, onChange, required }: PhoneFieldProps) {
  const id = useId()
  const ref = useRef<HTMLInputElement>(null)
  // Сколько цифр номера стояло слева от каретки на момент ввода — по этому
  // числу восстанавливаем позицию после переформатирования.
  const caretDigits = useRef<number | null>(null)

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target
    const raw = el.value
    const caret = el.selectionStart ?? raw.length

    // Цифры номера (без кода страны «7») слева от каретки — их и держимся.
    const leftDigits = raw
      .slice(0, caret)
      .replace(/\D/g, '')
      .replace(/^[78]/, '').length

    let digits = raw.replace(/\D/g, '')
    if (digits.startsWith('8') || digits.startsWith('7')) digits = digits.slice(1)
    // Мобильные РФ начинаются с 9: заведомо неверный код не пускаем.
    if (digits && digits[0] !== '9') {
      caretDigits.current = null
      return
    }

    caretDigits.current = Math.min(leftDigits, 10)
    onChange(digits.slice(0, 10))
  }

  // Браузер держит каретку на старом offset, а переформатирование сдвинуло
  // содержимое — без восстановления быстрый ввод перемешивает цифры, а
  // удаление «не срабатывает». Ставим каретку после той же по счёту цифры.
  useLayoutEffect(() => {
    const el = ref.current
    if (el && caretDigits.current !== null && document.activeElement === el) {
      const pos = caretAfterDigits(el.value, caretDigits.current)
      el.setSelectionRange(pos, pos)
    }
    caretDigits.current = null
  }, [value])

  return (
    <input
      ref={ref}
      id={id}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      required={required}
      placeholder="+7 (9__) ___-__-__"
      value={format(value)}
      onChange={onInput}
      className={inputClass}
      aria-label="Номер телефона"
    />
  )
}

/** Есть ли полные 10 цифр — для блокировки кнопки отправки. */
export const isPhoneComplete = (digits: string) => /^9\d{9}$/.test(digits)
