/**
 * Российский мобильный номер.
 *
 * Формат ввода на фронте: +7 (9xx) xxx-xx-xx. В БД храним в E.164 (+79XXXXXXXXX):
 * так номер не зависит от того, как его набрали, и его нельзя записать дважды
 * в разном оформлении.
 */

/** Оставляет цифры и приводит к 11 цифрам, начинающимся с 7. Иначе null. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, '')

  // 8XXXXXXXXXX и 7XXXXXXXXXX — одно и то же; 10 цифр — без кода страны.
  if (digits.length === 11 && digits.startsWith('8')) digits = '7' + digits.slice(1)
  else if (digits.length === 10) digits = '7' + digits

  // Только мобильные: код страны 7, первая цифра номера 9.
  if (!/^79\d{9}$/.test(digits)) return null

  return '+' + digits
}

/** +79231234567 -> +7 (923) 123-45-67. Для отображения. */
export function formatPhone(e164: string): string {
  const d = e164.replace(/\D/g, '')
  if (!/^79\d{9}$/.test(d)) return e164
  return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`
}
