import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi, setAccessToken } from '@/lib/api'
import { useAuth } from '@/store/auth'

/**
 * Приёмник соцвхода. Бэкенд после провайдера поставил refresh-куку и увёл сюда;
 * нам остаётся обменять её на access-токен и увести в кабинет. Если куки нет
 * (истекла или что-то пошло не так) — назад на вход.
 */
export function OAuthCallbackPage() {
  const navigate = useNavigate()
  const setSession = useAuth((s) => s.setSession)
  // React 19 StrictMode гоняет эффект дважды; refresh ротирует токен, поэтому
  // второй прогон запорол бы только что выданную сессию.
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true

    authApi
      .refresh()
      .then(({ accessToken, user }) => {
        setAccessToken(accessToken)
        setSession(accessToken, user)
        navigate('/profile', { replace: true })
      })
      .catch(() => navigate('/login?oauth_error=session', { replace: true }))
  }, [navigate, setSession])

  return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm text-white/50">
      Завершаем вход…
    </div>
  )
}
