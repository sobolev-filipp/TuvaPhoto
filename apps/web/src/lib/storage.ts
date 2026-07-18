/**
 * Обёртка над localStorage: в приватном режиме и при переполнении квоты
 * обращение к нему бросает исключение, а падать из-за баннера cookie нельзя.
 */
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Хранилище недоступно — молча продолжаем, выбор не переживёт перезагрузку.
  }
}
