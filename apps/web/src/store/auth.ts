import { create } from 'zustand'
import { authApi, setAccessToken, setUnauthorizedHandler, type ApiUser } from '@/lib/api'

/**
 * Состояние авторизации.
 *
 * Токен намеренно НЕ персистится: он живёт в памяти api-клиента, а после
 * перезагрузки вкладки сессия восстанавливается через httpOnly-куку (bootstrap).
 * `ready` отличает «ещё не проверяли» от «точно не авторизован» — без этого
 * защищённые страницы моргали бы редиректом на вход у залогиненного человека.
 */
interface AuthState {
  user: ApiUser | null
  ready: boolean
  setSession: (accessToken: string, user: ApiUser) => void
  setUser: (user: ApiUser) => void
  bootstrap: () => Promise<void>
  logout: () => Promise<void>
}

/** Общий in-flight промис bootstrap — защита от двойного вызова в StrictMode. */
let bootstrapPromise: Promise<void> | null = null

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,

  setSession: (accessToken, user) => {
    setAccessToken(accessToken)
    set({ user, ready: true })
  },

  setUser: (user) => set({ user }),

  bootstrap: async () => {
    // StrictMode вызывает эффект дважды. refresh ротирует токен, поэтому два
    // параллельных вызова: второй уходит с уже погашённым токеном, ловит 401
    // и обнулял бы только что восстановленную сессию. Делим один запрос.
    bootstrapPromise ??= (async () => {
      try {
        const { accessToken, user } = await authApi.refresh()
        setAccessToken(accessToken)
        useAuth.setState({ user, ready: true })
      } catch {
        // Куки нет или она протухла — это штатный путь гостя, не ошибка.
        setAccessToken(null)
        useAuth.setState({ user: null, ready: true })
      } finally {
        bootstrapPromise = null
      }
    })()
    return bootstrapPromise
  },

  logout: async () => {
    try {
      await authApi.logout()
    } finally {
      // Даже если запрос не дошёл, локально выходим: пользователь нажал «Выйти».
      setAccessToken(null)
      set({ user: null })
    }
  },
}))

/** Сессия протухла во время работы — сбрасываем пользователя. */
setUnauthorizedHandler(() => {
  setAccessToken(null)
  useAuth.setState({ user: null, ready: true })
})

export const useIsOwner = () => useAuth((s) => s.user?.role === 'OWNER')
