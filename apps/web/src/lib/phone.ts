/** +79233882707 -> +7 (923) 388-27-07. Дублирует форматтер сервера. */
export function formatPhone(e164: string): string {
  const d = e164.replace(/\D/g, '')
  if (!/^79\d{9}$/.test(d)) return e164
  return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`
}
