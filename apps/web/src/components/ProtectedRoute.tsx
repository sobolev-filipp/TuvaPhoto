import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/store/auth'

/**
 * Пускает только авторизованных.
 *
 * Пока `ready === false`, сессия ещё восстанавливается по куке. Показывать в
 * этот момент редирект на вход нельзя: залогиненного человека выбрасывало бы
 * на форму при каждой перезагрузке.
 */
export function ProtectedRoute({ role }: { role?: 'OWNER' }) {
  const user = useAuth((s) => s.user)
  const ready = useAuth((s) => s.ready)
  const location = useLocation()

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-white/40">
        Загружаем…
      </div>
    )
  }

  if (!user) {
    // Запоминаем, куда шли: после входа вернём человека на то же место.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // Онбординг владельца: пока не сменил заводские доступы и не заполнил профиль,
  // держим его на нужном шаге и никуда больше не пускаем.
  if (user.mustChangeCredentials && location.pathname !== '/finish-setup') {
    return <Navigate to="/finish-setup" replace />
  }
  if (
    !user.mustChangeCredentials &&
    user.mustCompleteProfile &&
    location.pathname !== '/finish-profile'
  ) {
    return <Navigate to="/finish-profile" replace />
  }

  if (role && user.role !== role) return <Navigate to="/profile" replace />

  return <Outlet />
}
