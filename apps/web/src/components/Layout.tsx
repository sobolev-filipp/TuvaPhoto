import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Nav } from './Nav'
import { Footer } from './Footer'
import { CookieBanner } from './CookieBanner'
import { FloatingCall } from './FloatingCall'
import { InstallBanner } from '@/pwa/InstallBanner'
import { UpdatePrompt } from '@/pwa/UpdatePrompt'

/** Сброс прокрутки при смене роута — иначе новая страница открывается в середине. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
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
