import { useEffect } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { Nav } from './Nav'
import { Footer } from './Footer'
import { CookieBanner } from './CookieBanner'
import { FloatingCall } from './FloatingCall'
import { InstallBanner } from '@/pwa/InstallBanner'
import { UpdatePrompt } from '@/pwa/UpdatePrompt'

/**
 * Сброс прокрутки при переходе на новую страницу — иначе она открывается в
 * середине. Но при навигации «назад/вперёд» (POP) скролл не трогаем: браузер
 * сам вернёт позицию туда, где пользователь был (например, в каталоге).
 */
function ScrollToTop() {
  const { pathname } = useLocation()
  const navType = useNavigationType()
  useEffect(() => {
    if (navType !== 'POP') window.scrollTo(0, 0)
  }, [pathname, navType])
  return null
}

export function Layout() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <ScrollToTop />
      <Nav />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <FloatingCall />
      <CookieBanner />
      <InstallBanner />
      <UpdatePrompt />
    </div>
  )
}
