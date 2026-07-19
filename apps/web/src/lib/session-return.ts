/**
 * Возврат после входа и черновик конструктора.
 *
 * Держим в sessionStorage, а не в location.state: вход через 2FA — это переход
 * между страницами, а соцвход — вообще полный редирект на провайдера и обратно.
 * И то и другое стёрло бы состояние роутера, но не sessionStorage.
 */

const REDIRECT_KEY = 'tf.postLoginRedirect'
const DRAFT_KEY = 'tf.constructorDraft'

/** Куда вернуть пользователя после успешного входа. */
export function setPostLoginRedirect(path: string): void {
  try {
    sessionStorage.setItem(REDIRECT_KEY, path)
  } catch {
    /* приватный режим без хранилища — просто не запоминаем */
  }
}

/** Забрать и очистить путь возврата (одноразовый). */
export function takePostLoginRedirect(): string | null {
  try {
    const v = sessionStorage.getItem(REDIRECT_KEY)
    if (v) sessionStorage.removeItem(REDIRECT_KEY)
    return v
  } catch {
    return null
  }
}

/** Снимок выбранных в конструкторе параметров — переживает переход на вход. */
export interface ConstructorDraft {
  category: string | null
  cover: string | null
  shoots: string[]
  spreads: number
  prepayKind: 'percent' | 'full' | 'custom'
  prepayPercent: number
  customAmount: string
  fio: string
  school: string
  phone: string
  agreed: boolean
}

export function saveConstructorDraft(draft: ConstructorDraft): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* нет хранилища — не критично, просто не восстановим */
  }
}

/** Забрать и очистить черновик (восстанавливаем один раз после возврата). */
export function takeConstructorDraft(): ConstructorDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    sessionStorage.removeItem(DRAFT_KEY)
    return JSON.parse(raw) as ConstructorDraft
  } catch {
    return null
  }
}
