import { useEffect } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { HomePage } from './pages/HomePage'
import { CatalogPage } from './pages/CatalogPage'
import { AlbumPage } from './pages/AlbumPage'
import { ContactsPage } from './pages/ContactsPage'
import { InstallPage } from './pages/InstallPage'
import { ProfilePage } from './pages/ProfilePage'
import { SecurityPage } from './pages/profile/SecurityPage'
import { ConnectionsPage } from './pages/profile/ConnectionsPage'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { VerifyPage } from './pages/auth/VerifyPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { OAuthCallbackPage } from './pages/auth/OAuthCallbackPage'
import { FinishSetupPage } from './pages/auth/FinishSetupPage'
import { FinishProfilePage } from './pages/auth/FinishProfilePage'
import { useAuth } from './store/auth'

/** Заглушка для разделов, которые делаем следующими этапами. */
function Stub({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-[100px] md:px-10">
      <h1 className="font-display m-0 mb-4 text-[32px] font-extrabold">{title}</h1>
      <p className="text-white/55">Раздел в работе.</p>
    </div>
  )
}

function NotFound() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-[100px] text-center md:px-10">
      <div className="font-display mb-4 text-[64px] leading-none font-extrabold text-gold">404</div>
      <h1 className="font-display m-0 mb-4 text-[26px] font-extrabold">Страница не найдена</h1>
      <Link to="/" className="font-semibold">
        ← На главную
      </Link>
    </div>
  )
}

export default function App() {
  const bootstrap = useAuth((s) => s.bootstrap)

  // Восстанавливаем сессию по httpOnly-куке до первого рендера приватных страниц.
  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="album/:id" element={<AlbumPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="install" element={<InstallPage />} />
        <Route path="constructor" element={<Stub title="Конструктор альбома" />} />
        <Route path="privacy" element={<Stub title="Политика обработки персональных данных" />} />

        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="verify" element={<VerifyPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="oauth/callback" element={<OAuthCallbackPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="finish-setup" element={<FinishSetupPage />} />
          <Route path="finish-profile" element={<FinishProfilePage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/security" element={<SecurityPage />} />
          <Route path="profile/connections" element={<ConnectionsPage />} />
          <Route path="profile/albums" element={<Stub title="Мои альбомы" />} />
        </Route>
        <Route element={<ProtectedRoute role="OWNER" />}>
          <Route path="admin" element={<Stub title="Админ-панель" />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
